import { expect,it,vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { intentFixture } from '../helpers/funding.js';
import { required } from '../helpers/auth.js';
import { bounties,submissions } from '../../src/db/schema.js';
import { linkPr } from '../../src/actions/link.js';
import { candidateScanner } from '../../src/settlement/candidates.js';
import type { PullRequest } from '../../src/github/app.js';
const pr:PullRequest={id:'501',number:42,state:'open',title:'Fix parser',body:'Fixes #12',merged_at:null,closed_at:null,user:{id:'8',login:'contributor',type:'User'},head:{sha:'a'.repeat(40)},base:{sha:'b'.repeat(40),repo:{id:'2'}}};
async function fixture(){
 const f=await intentFixture();
 const bounty=required((await f.database.orm.update(bounties).set({status:'FUNDED',fundedTerms:f.terms}).where(eq(bounties.id,f.bounty.id)).returning())[0]);
 vi.mocked(f.api.pullRequests).mockResolvedValue({pulls:[pr],complete:true});
 vi.mocked(f.api.pullRequest).mockResolvedValue(pr);
 vi.mocked(f.api.closingIssues).mockResolvedValue({prId:pr.id,issueNumbers:[12],complete:true});
 return {...f,bounty,scan:candidateScanner(f.database,f.api,f.env)};
}
it('holds a scan if the PR inventory changes before it completes',async()=>{
 const f=await fixture();try{
  vi.mocked(f.api.pullRequests).mockResolvedValueOnce({pulls:[pr],complete:true}).mockResolvedValue({pulls:[pr,{...pr,id:'502',number:43}],complete:true});
  expect((await f.scan(f.bounty.id)).complete).toBe(false);
 }finally{await f.close();}
});
it('incomplete closing references cannot commit a complete candidate scan',async()=>{
 const f=await fixture();try{
  vi.mocked(f.api.closingIssues).mockResolvedValue({prId:pr.id,issueNumbers:[12],complete:false});
  expect((await f.scan(f.bounty.id)).complete).toBe(false);
  expect(await f.database.orm.select().from(submissions)).toHaveLength(0);
 }finally{await f.close();}
});
it('retains saved manual links after the issue reference is removed',async()=>{
 const f=await fixture();try{
  await linkPr(f.database,f.bounty,pr);
  const changed={...pr,body:'Reference removed'};
  vi.mocked(f.api.pullRequests).mockResolvedValue({pulls:[changed],complete:true});
  vi.mocked(f.api.pullRequest).mockResolvedValue(changed);
  vi.mocked(f.api.closingIssues).mockResolvedValue({prId:pr.id,issueNumbers:[],complete:true});
  const scan=await f.scan(f.bounty.id);
  expect(scan.complete).toBe(true);expect(scan.submissions).toHaveLength(1);expect(scan.submissions[0]?.prId).toBe(pr.id);
 }finally{await f.close();}
});
