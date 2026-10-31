import { expect,it,vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { awardFixture } from '../helpers/awards.js';
import { csrfFrom,form,required } from '../helpers/auth.js';
import { attestContribution,confirmedContributors } from '../../src/actions/attribution.js';
import { bounties,contributorAttestations,submissions } from '../../src/db/schema.js';
import { collectVerification } from '../../src/verifier/collect.js';
async function setup(){
 const f=await awardFixture(),sub=await f.add('501','2026-10-30T01:00:00Z');
 await f.database.orm.update(submissions).set({status:'OPEN',mergedAt:null,mergeSha:null}).where(eq(submissions.id,sub.id));
 const maintainer=await f.auth.requireSession(f.login.cookie);
 f.provider.identity=()=>Promise.resolve({id:'9',login:'second'});
 const u=new URL(await f.auth.beginLogin('/','second-binding')),login=await f.auth.completeLogin('code',required(u.searchParams.get('state')),'second-binding'),contributor=await f.auth.requireSession(login.cookie);
 vi.mocked(f.api.pullRequestCommits).mockResolvedValue({authors:[{ghId:'8',login:'author',type:'User'},{ghId:'9',login:'second',type:'User'}],complete:true});
 const input={headSha:sub.headSha,baseSha:sub.baseSha,kind:'claim',claimantGhId:'9',reason:'Implemented the array serialization and regression tests.'};
 const attest=(kind='claim',actor=contributor,overrides={})=>attestContribution(f.database,f.auth,f.api,actor,sub.id,{...input,kind,...overrides});
 return {...f,sub,maintainer,contributor,attest,input};
}
it('requires both independent confirmations, concurrent replay is idempotent and evidence admits only that revision',async()=>{const f=await setup();try{
 await expect(f.attest('confirm',f.maintainer)).rejects.toThrow(/contributor must confirm/);
 await Promise.all([f.attest(),f.attest()]);expect(await confirmedContributors(f.database,f.sub)).toEqual([]);
 await expect(f.attest('confirm')).rejects.toThrow(/separate/);
 await Promise.all([f.attest('confirm',f.maintainer),f.attest('confirm',f.maintainer)]);
 expect(await f.database.orm.select().from(contributorAttestations)).toHaveLength(2);
 expect(await confirmedContributors(f.database,f.sub)).toEqual([{ghId:'9',login:'second'}]);
 expect(await confirmedContributors(f.database,{...f.sub,headSha:'d'.repeat(40)})).toEqual([]);
 expect(await confirmedContributors(f.database,{...f.sub,baseSha:'d'.repeat(40)})).toEqual([]);
 const sub=required((await f.database.orm.select().from(submissions))[0]);expect(sub.evidenceVersion).toBe(3);
 const evidence=await collectVerification({database:f.database,github:f.api,env:f.env,installationId:'1',repo:await f.api.repository('1','2'),bounty:f.bounty,submission:sub,terms:f.terms,expectedHeadSha:sub.headSha});
 expect(evidence.eligibleAuthors.map(a=>a.ghId)).toEqual(['8','9']);expect(evidence.unverifiedAuthors).toEqual([]);
 await expect(f.database.orm.update(contributorAttestations).set({reason:'rewritten history'})).rejects.toThrow();
 }finally{await f.close();}});
it('rejects forged claims, creator, PR author, permission loss, incomplete commit evidence and stale remote revision',async()=>{const f=await setup();try{
 for(const id of ['4','8','10'])await expect(f.attest('claim',f.contributor,{claimantGhId:id})).rejects.toThrow();
 await f.attest();f.permissions.write=false;await expect(f.attest('confirm',f.maintainer)).rejects.toThrow(/permission/);f.permissions.write=true;
 vi.mocked(f.api.pullRequestCommits).mockResolvedValue({authors:[],complete:false});await expect(f.attest('confirm',f.maintainer)).rejects.toThrow(/commit evidence/);
 const pr=await f.api.pullRequest('1',await f.api.repository('1','2'),501);vi.mocked(f.api.pullRequest).mockResolvedValue({...pr,head:{sha:'d'.repeat(40)}});
 await expect(f.attest('confirm',f.maintainer)).rejects.toThrow(/current open PR/);expect(await confirmedContributors(f.database,f.sub)).toEqual([]);
 }finally{await f.close();}});
it('holds attribution during settlement states and fences an earlier candidate scan',async()=>{const f=await setup();try{
 const before=await f.scan();await f.attest();const after=await f.scan();expect(after.bountyVersion).toBe(before.bountyVersion+1);expect(after.hash).not.toBe(before.hash);
 for(const status of ['AWAITING_CLAIM','PAYING','PAID','REFUNDING']){await f.database.orm.update(bounties).set({status}).where(eq(bounties.id,f.bounty.id));await expect(f.attest('confirm',f.maintainer)).rejects.toThrow(/state changed/);}
 expect(await confirmedContributors(f.database,f.sub)).toEqual([]);
 }finally{await f.close();}});
it('HTTP confirmation is CSRF protected and cannot substitute the authenticated claimant',async()=>{const f=await setup();try{
 await f.attest();const path=`/submissions/${f.sub.id}/contributors`;const page=await f.request(path);expect(page.status).toBe(200);const csrf=csrfFrom(await page.text());
 // Maintainer is the bounty creator and cannot claim the second contributor identity.
 expect((await f.request(path,form(csrf,f.input))).status).toBe(403);
 const bad=form(csrf,f.input);bad.headers.Origin='https://evil.test';expect((await f.request(path,bad)).status).toBe(403);
 expect(await f.database.orm.select().from(contributorAttestations)).toHaveLength(1);
 }finally{await f.close();}});
