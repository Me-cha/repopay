import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { buildVerifierPrompt } from '../../src/verifier/prompt.js';
import { retryCommentReview } from '../../src/actions/retry.js';
import { handleJob } from '../../src/jobs/runner.js';
import type { Work,LeasedJob } from '../../src/jobs/kinds.js';
import { jobs } from '../../src/db/schema.js';
import { expect,it,vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { awardFixture } from '../helpers/awards.js';
import { csrfFrom,form,required } from '../helpers/auth.js';
import { attestContribution,attestCommentContribution,confirmedContributors } from '../../src/actions/attribution.js';
import { bounties,contributorAttestations,submissions } from '../../src/db/schema.js';
import { collectVerification } from '../../src/verifier/collect.js';
async function setup(){
 const f=await awardFixture(),sub=await f.add('501','2026-10-30T01:00:00Z');
 await f.database.orm.update(submissions).set({status:'OPEN',mergedAt:null,mergeSha:null}).where(eq(submissions.id,sub.id));
 const maintainer=await f.auth.requireSession(f.login.cookie);
 f.provider.identity=()=>Promise.resolve({id:'9',login:'second'});
 const u=new URL(await f.auth.beginLogin('/','second-binding')),login=await f.auth.completeLogin('code',required(u.searchParams.get('state')),'second-binding'),contributor=await f.auth.requireSession(login.cookie);
 vi.mocked(f.api.pullRequestCommits).mockResolvedValue({authors:[{ghId:'8',login:'author',type:'User',commitSha:'a'.repeat(40)},{ghId:'9',login:'second',type:'User',commitSha:'c'.repeat(40)}],complete:true});
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
 const prompt=buildVerifierPrompt(evidence);expect(prompt).toContain('githubAssociatedCommits');expect(prompt).toContain('c'.repeat(40));expect(prompt).toContain('Implemented the array serialization');
 const block=z.object({attestations:z.array(z.object({actorGhId:z.string()})),confirmedAdditionalAuthorIds:z.array(z.string())}).parse(JSON.parse(evidence.diff.split('reasons are untrusted user statements)\n')[1]??'{}'));expect(block.attestations).toHaveLength(2);expect(block.confirmedAdditionalAuthorIds).toEqual(['9']);expect(block.attestations.map((a:{actorGhId:string})=>a.actorGhId)).toEqual(['9','4']);
 const stale=await collectVerification({database:f.database,github:f.api,env:f.env,installationId:'1',repo:await f.api.repository('1','2'),bounty:f.bounty,submission:{...sub,headSha:'d'.repeat(40)},terms:f.terms,expectedHeadSha:sub.headSha});expect(stale.diff).not.toContain('Implemented the array serialization');expect(stale.unverifiedAuthors).toEqual(['9']);
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

async function commentJob(f:Awaited<ReturnType<typeof setup>>,actorId:string,confirm=false,overrides:Record<string,unknown>={}):Promise<LeasedJob>{
 const work:Work={kind:'run_command',installationId:'1',repoId:'2',issueNumber:f.sub.prNumber,isPullRequest:true,actorId,commentId:'99',command:confirm?{kind:'confirm-contributor',login:'second',headSha:f.sub.headSha,baseSha:f.sub.baseSha,reason:f.input.reason}:{kind:'contribute',headSha:f.sub.headSha,baseSha:f.sub.baseSha,reason:f.input.reason}};
 const payload={...work,...overrides},leaseToken=randomUUID();
 const saved=required((await f.database.orm.insert(jobs).values({kind:'run_command',payload,status:'running',leaseOwner:'test',leaseToken,leaseHeartbeatAt:new Date(),lockedUntil:new Date(Date.now()+60000),attempts:1,maxAttempts:3}).returning())[0]);
 return {id:saved.id,kind:saved.kind,payload,leaseOwner:'test',leaseToken,attempts:1,maxAttempts:3};
}
it('PR commands preserve independent identity, idempotency and copied confirmation instructions without model jobs',async()=>{const f=await setup();try{
 const claim=await commentJob(f,'9');await handleJob(f.database,f.api,f.env,claim);await handleJob(f.database,f.api,f.env,claim);
 expect(await confirmedContributors(f.database,f.sub)).toEqual([]);
 expect(f.api.createComment).toHaveBeenCalledWith('1',expect.anything(),f.sub.prNumber,expect.stringContaining('/bounty confirm-contributor #12 @second'));
 const confirm=await commentJob(f,'4',true);await handleJob(f.database,f.api,f.env,confirm);await handleJob(f.database,f.api,f.env,confirm);
 expect(await confirmedContributors(f.database,f.sub)).toEqual([{ghId:'9',login:'second'}]);
 expect(await f.database.orm.select().from(contributorAttestations)).toHaveLength(2);
 const all=await f.database.orm.select().from(jobs);expect(all.filter(j=>j.kind==='sync_submission')).toHaveLength(2);expect(all.filter(j=>j.kind==='verify_submission')).toHaveLength(0);
 }finally{await f.close();}});
it('PR attestations reject self-confirmation, removed permissions, wrong scope, stale revisions and expired leases',async()=>{const f=await setup();try{
 const claim=await commentJob(f,'9');await attestCommentContribution(f.database,f.api,claim,f.sub.id);
 await expect(attestCommentContribution(f.database,f.api,await commentJob(f,'9',true),f.sub.id)).rejects.toThrow(/separate/);
 vi.mocked(f.api.permission).mockResolvedValue('read');await expect(attestCommentContribution(f.database,f.api,await commentJob(f,'4',true),f.sub.id)).rejects.toThrow(/permission/);
 vi.mocked(f.api.permission).mockResolvedValue('write');
 await expect(attestCommentContribution(f.database,f.api,await commentJob(f,'4',true,{repoId:'999'}),f.sub.id)).rejects.toThrow(/scope/);
 const expired=await commentJob(f,'4',true);await f.database.orm.update(jobs).set({lockedUntil:new Date(0)}).where(eq(jobs.id,expired.id));await expect(attestCommentContribution(f.database,f.api,expired,f.sub.id)).rejects.toThrow(/lease/);
 const pr=await f.api.pullRequest('1',await f.api.repository('1','2'),501);vi.mocked(f.api.pullRequest).mockResolvedValue({...pr,base:{...pr.base,sha:'d'.repeat(40)}});
 await expect(attestCommentContribution(f.database,f.api,await commentJob(f,'4',true),f.sub.id)).rejects.toThrow(/current open PR/);
 expect(await confirmedContributors(f.database,f.sub)).toEqual([]);
 }finally{await f.close();}});

it('PR retry queues one bounded job, coalesces concurrent requests and survives acknowledgement replay',async()=>{const f=await setup();try{
 const command={kind:'retry',headSha:f.sub.headSha,baseSha:f.sub.baseSha};
 const first=await commentJob(f,'4',false,{command}),second=await commentJob(f,'4',false,{command});
 await Promise.all([retryCommentReview(f.database,f.api,first,f.sub.id),retryCommentReview(f.database,f.api,second,f.sub.id)]);
 let reviews=(await f.database.orm.select().from(jobs)).filter(j=>j.kind==='verify_submission');expect(reviews).toHaveLength(1);expect(reviews[0]?.maxAttempts).toBe(1);
 await f.database.orm.update(jobs).set({status:'done'}).where(eq(jobs.kind,'verify_submission'));
 await retryCommentReview(f.database,f.api,first,f.sub.id);reviews=(await f.database.orm.select().from(jobs)).filter(j=>j.kind==='verify_submission');expect(reviews).toHaveLength(1);
 await handleJob(f.database,f.api,f.env,first);expect(f.api.createComment).toHaveBeenCalledWith('1',expect.anything(),f.sub.prNumber,expect.stringContaining('no duplicate'));
 }finally{await f.close();}});
it('PR retry fails closed for read-only actors, mismatched scope/revision, expired leases and funding holds',async()=>{const f=await setup();try{
 const command={kind:'retry',headSha:f.sub.headSha,baseSha:f.sub.baseSha};
 const make=(overrides={})=>commentJob(f,'4',false,{command,...overrides});
 vi.mocked(f.api.permission).mockResolvedValue('read');await expect(retryCommentReview(f.database,f.api,await make(),f.sub.id)).rejects.toThrow(/write permission/);vi.mocked(f.api.permission).mockResolvedValue('write');
 await expect(retryCommentReview(f.database,f.api,await make({repoId:'999'}),f.sub.id)).rejects.toThrow(/scope/);
 await expect(retryCommentReview(f.database,f.api,await make({command:{...command,baseSha:'d'.repeat(40)}}),f.sub.id)).rejects.toThrow(/revision changed/);
 const expired=await make();await f.database.orm.update(jobs).set({lockedUntil:new Date(0)}).where(eq(jobs.id,expired.id));await expect(retryCommentReview(f.database,f.api,expired,f.sub.id)).rejects.toThrow(/lease/);
 await f.database.orm.update(bounties).set({fundingHold:true}).where(eq(bounties.id,f.bounty.id));await expect(retryCommentReview(f.database,f.api,await make(),f.sub.id)).rejects.toThrow(/state changed/);
 expect((await f.database.orm.select().from(jobs)).filter(j=>j.kind==='verify_submission')).toHaveLength(0);
 }finally{await f.close();}});
it('PR status replies on the PR and ambiguous linked bounties cannot trigger reviews',async()=>{const f=await setup();try{
 await handleJob(f.database,f.api,f.env,await commentJob(f,'9',false,{command:{kind:'status'}}));expect(f.api.createComment).toHaveBeenCalledWith('1',expect.anything(),f.sub.prNumber,expect.stringContaining('Repopay status'));
 await handleJob(f.database,f.api,f.env,await commentJob(f,'4',false,{command:{kind:'retry',issueNumber:999}}));expect(f.api.createComment).toHaveBeenCalledWith('1',expect.anything(),f.sub.prNumber,expect.stringContaining('linked issue number'));
 expect((await f.database.orm.select().from(jobs)).filter(j=>j.kind==='verify_submission')).toHaveLength(0);
 }finally{await f.close();}});
