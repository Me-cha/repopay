import { afterEach,describe,expect,it } from 'vitest';
import { githubFixture } from '../helpers/github.js';
import { installations,bounties,submissions } from '../../src/db/schema.js';
import { linkPr } from '../../src/actions/link.js';
import { required } from '../helpers/auth.js';
import type { PullRequest } from '../../src/github/app.js';

const pr=(number:number,id:string,authorId:string,head='a'.repeat(40),state:'open'|'closed'='open'):PullRequest=>({id,number,state,title:`Fix #12`,body:'Resolves #12',merged_at:state==='closed'?'2026-10-29T10:00:00Z':null,closed_at:state==='closed'?'2026-10-29T10:00:00Z':null,user:{id:authorId,login:`user-${authorId}`,type:'User'},head:{sha:head},base:{sha:'b'.repeat(40),repo:{id:'2'}}});

describe('open bounty submissions',()=>{
 let f:Awaited<ReturnType<typeof githubFixture>>|undefined;
 afterEach(async()=>{await f?.close();f=undefined;});
 async function setup(){f=await githubFixture();await f.database.orm.insert(installations).values({id:'1',accountId:'10',accountLogin:'owner'});const [bounty]=await f.database.orm.insert(bounties).values({installationId:'1',repoId:'2',repoFullName:'owner/repo',issueNumber:12,amountCents:5000,createdByGhId:'4',createdVia:'command'}).returning();return required(bounty);}
 it('retains competing submissions without reserving or assigning a bounty',async()=>{
  const bounty=await setup(),fixture=required(f);await linkPr(fixture.database,bounty,pr(41,'501','8'));await linkPr(fixture.database,bounty,pr(42,'502','9'));
  const rows=await fixture.database.orm.select().from(submissions);expect(rows).toHaveLength(2);expect(rows.map(row=>row.authorGhId).sort()).toEqual(['8','9']);expect(rows.every(row=>row.status==='OPEN')).toBe(true);
  const [unchanged]=await fixture.database.orm.select().from(bounties);expect(unchanged?.status).toBe('OPEN');expect(unchanged?.fundingActorGhId).toBeNull();
 });
 it('updates the revision and preserves a closed or merged claim as evidence',async()=>{
  const bounty=await setup(),fixture=required(f);const first=await linkPr(fixture.database,bounty,pr(41,'501','8'));const changed=await linkPr(fixture.database,bounty,pr(41,'501','8','c'.repeat(40),'closed'));
  expect(first.changed).toBe(true);expect(changed.changed).toBe(true);expect(changed.submission.status).toBe('MERGED');expect(changed.submission.headSha).toBe('c'.repeat(40));
  expect(await fixture.database.orm.select().from(submissions)).toHaveLength(1);
 });
 it('rejects a pull request targeting another repository and preserves the bounty',async()=>{
  const bounty=await setup(),fixture=required(f);await expect(linkPr(fixture.database,bounty,{...pr(41,'501','8'),base:{sha:'b'.repeat(40),repo:{id:'3'}}})).rejects.toThrow(/target/);
  expect(await fixture.database.orm.select().from(submissions)).toHaveLength(0);
 });
});
