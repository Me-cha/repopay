import { expect,it } from 'vitest';
import { eq } from 'drizzle-orm';
import { required } from '../helpers/auth.js';
import { awards,bounties,copilotSponsors,verifications } from '../../src/db/schema.js';
import { createHash } from 'node:crypto';
import { buildVerifierPrompt,PROMPT_VERSION } from '../../src/verifier/prompt.js';
import type { VerifyInput } from '../../src/verifier/collect.js';
import { createSettlement } from '../../src/settlement/settle.js';
import { awardFixture } from '../helpers/awards.js';
it.each(['unchanged','criteria','diff','ci'] as const)('checks the actual JSONB-normalized remote prompt before settlement: %s',async change=>{
 const f=await awardFixture();try{
  const sub=await f.add('501','2026-10-30T01:00:00Z');
  const scan=await f.scan(),fresh=required(scan.evidence.get(sub.id));
  // The broker hashes this representation after persisting the dispatch input.
  const saved=required((await f.database.pool.query<{input:VerifyInput}>('select $1::jsonb as input',[JSON.stringify(fresh)])).rows[0]).input;
  const hash=(input:VerifyInput)=>createHash('sha256').update(PROMPT_VERSION+'\n'+buildVerifierPrompt(input)).digest('hex');
  expect(hash(saved)).not.toBe(hash(fresh));
  await f.database.orm.update(verifications).set({promptHash:hash(saved)}).where(eq(verifications.submissionId,sub.id));
  if(change==='criteria')fresh.criteria+=' Added requirement';
  if(change==='diff')fresh.diff+=' changed context';
  if(change==='ci')fresh.ci={...fresh.ci,status:'fail'};
  const result=await f.service.settleBounty(f.bounty.id);
  expect(result?.kind).toBe(change==='unchanged'?'awarded':'held');
  expect(await f.database.orm.select().from(awards)).toHaveLength(change==='unchanged'?1:0);
 }finally{await f.close();}
});
it('reverse arrival order and concurrent settlement select one earliest immutable award',async()=>{
 const f=await awardFixture();try{
  await f.add('502','2026-10-30T02:00:00Z');const earliest=await f.add('501','2026-10-30T01:00:00Z');
  await Promise.all([f.service.settleBounty(f.bounty.id),f.service.settleBounty(f.bounty.id)]);
  const rows=await f.database.orm.select().from(awards);expect(rows).toHaveLength(1);expect(rows[0]?.submissionId).toBe(earliest.id);
  expect(rows[0]?.allocation.reduce((sum,a)=>sum+a.cents,0)).toBe(5000);
  await expect(f.database.orm.update(awards).set({amountCents:1})).rejects.toThrow();
  await expect(f.database.orm.delete(awards)).rejects.toThrow();
 }finally{await f.close();}
});
it('earlier unresolved merge blocks later valid verdict; latest error cannot fall back',async()=>{
 const f=await awardFixture();try{
  await f.add('501','2026-10-30T01:00:00Z','ERROR');await f.add('502','2026-10-30T02:00:00Z');
  expect((await f.service.settleBounty(f.bounty.id))?.kind).toBe('held');expect(await f.database.orm.select().from(awards)).toHaveLength(0);
 }finally{await f.close();}
});
it('partial scans, stale scan revisions and an unaccepted profile cannot award',async()=>{
 const f=await awardFixture();try{
  await f.add('501','2026-10-30T01:00:00Z');const scan=await f.scan();
  for(const change of [{...scan,complete:false},{...scan,bountyVersion:99}])expect((await createSettlement(f.database,{scan:()=>Promise.resolve(change),profileAccepted:()=>Promise.resolve(true)}).settleBounty(f.bounty.id))?.kind).toBe('held');
  expect((await createSettlement(f.database,{scan:f.scan}).settleBounty(f.bounty.id))?.kind).toBe('held');
  expect(await f.database.orm.select().from(awards)).toHaveLength(0);
 }finally{await f.close();}
});
it('late discovery records a dispute without changing the award or paying twice',async()=>{
 const f=await awardFixture();try{
  const winner=await f.add('502','2026-10-30T02:00:00Z');await f.service.settleBounty(f.bounty.id);
  await f.add('501','2026-10-30T01:00:00Z');await f.service.settleBounty(f.bounty.id);
  const rows=await f.database.orm.select().from(awards);expect(rows).toHaveLength(1);expect(rows[0]?.submissionId).toBe(winner.id);
  const b=required((await f.database.orm.select().from(bounties))[0]);expect(b.attentionReason).toContain('Earlier merged candidate');
 }finally{await f.close();}
});

it('a revoked sponsor cannot create an award even after profile acceptance',async()=>{
 const f=await awardFixture();try{
  await f.add('501','2026-10-30T01:00:00Z');
  await f.database.orm.update(copilotSponsors).set({revokedAt:new Date()}).where(eq(copilotSponsors.repoId,'2'));
  expect((await f.service.settleBounty(f.bounty.id))?.kind).toBe('held');
  expect(await f.database.orm.select().from(awards)).toHaveLength(0);
 }finally{await f.close();}
});
it('a different Auto serving model cannot reuse another models evaluation',async()=>{
 const f=await awardFixture();try{
  await f.add('501','2026-10-30T01:00:00Z');
  const service=createSettlement(f.database,{scan:f.scan,profileAccepted:()=>Promise.resolve(true),acceptedServingModels:['other-model']});
  expect((await service.settleBounty(f.bounty.id))?.kind).toBe('held');
  expect(await f.database.orm.select().from(awards)).toHaveLength(0);
 }finally{await f.close();}
});
