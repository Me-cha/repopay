import { createHmac } from 'node:crypto';
import { expect, it } from 'vitest';
import { createTestDatabase } from '../helpers/database.js';
import { migrateDatabase } from '../../src/db/migrate.js';
import { jobs, deliveries } from '../../src/db/schema.js';
import { ingestGitHub } from '../../src/github/handlers.js';
import { testEnv } from '../helpers/github.js';
const secret = 'w'.repeat(32);
export const event = { action: 'created', installation: { id: 1 }, repository: { id: 2 }, issue: { number: 12 }, comment: { id: 3, body: '/bounty create 50', user: { id: 4, type: 'User' } } };
function signed(body: Buffer, deliveryId = 'delivery-1') { return { event: 'issue_comment', deliveryId, signature: 'sha256=' + createHmac('sha256', secret).update(body).digest('hex') }; }
it('invalid signature rejected; duplicate delivery creates one durable job', async () => {
 const f = await createTestDatabase(); try {
  await migrateDatabase(f.database); const raw = Buffer.from(JSON.stringify(event));
  await expect(ingestGitHub(f.database, secret, 3, raw, { ...signed(raw), signature: 'sha256=' + '0'.repeat(64) })).rejects.toThrow();
  expect(await f.database.orm.select().from(deliveries)).toHaveLength(0);
  await Promise.all([1,2].map(() => ingestGitHub(f.database, secret, 3, raw, signed(raw))));
  expect(await f.database.orm.select().from(deliveries)).toHaveLength(1);
  expect(await f.database.orm.select().from(jobs)).toHaveLength(1);
 } finally { await f.close(); }
});
it('enqueue failure rolls receipt back; edited, bot and unknown events do not execute', async () => {
 const f = await createTestDatabase(); try {
  await migrateDatabase(f.database); const raw = Buffer.from(JSON.stringify(event));
  await expect(ingestGitHub(f.database, secret, 0, raw, signed(raw))).rejects.toThrow();
  expect(await f.database.orm.select().from(deliveries)).toHaveLength(0);
  await ingestGitHub(f.database, secret, 3, raw, signed(raw));
  for (const [i, change] of [{ action: 'edited' }, { comment: { ...event.comment, user: { id: 4, type: 'Bot' } } }].entries()) {
   const data = Buffer.from(JSON.stringify({ ...event, ...change })); await ingestGitHub(f.database, secret, 3, data, signed(data, 'ignored-' + String(i)));
  }
  expect(await f.database.orm.select().from(jobs)).toHaveLength(1);
 } finally { await f.close(); }
});
it('HTTP route rejects oversized/forged bodies and persists supported delivery before 202',async()=>{
 const f=await createTestDatabase();await migrateDatabase(f.database);
 const {startServer}=await import('../../src/main.js');const {testEnv}=await import('../helpers/github.js');
 const server=await startServer({...testEnv,WEBHOOK_BODY_MAX_BYTES:1024},f.database,0,{runWorker:false});
 try{
  const raw=Buffer.from(JSON.stringify(event));const headers=signed(raw);
  const send=(body:string,signature:string)=>fetch(server.url+'/webhooks/github',{method:'POST',headers:{'content-type':'application/json','x-github-event':'issue_comment','x-github-delivery':'http-delivery','x-hub-signature-256':signature},body});
  expect((await send(raw.toString(),headers.signature)).status).toBe(202);
  expect(await f.database.orm.select().from(jobs)).toHaveLength(1);
  expect((await send(raw.toString(),'sha256='+'0'.repeat(64))).status).toBe(401);
  expect((await send('x'.repeat(2000),headers.signature)).status).toBe(413);
 }finally{await server.close();await f.close();}
});
it('unsafe numeric IDs are rejected and payloads retain only normalized command fields',async()=>{
 const f=await createTestDatabase();try{
  await migrateDatabase(f.database);
  const unsafe=Buffer.from(JSON.stringify({...event,installation:{id:9007199254740992}}));await expect(ingestGitHub(f.database,secret,3,unsafe,signed(unsafe))).rejects.toThrow();
  const good=Buffer.from(JSON.stringify({...event,sensitive:'do not retain',comment:{...event.comment,body:'/bounty create 50\nprivate context'}}));await ingestGitHub(f.database,secret,3,good,signed(good));
  const [job]=await f.database.orm.select().from(jobs);expect(JSON.stringify(job?.payload)).not.toContain('private context');expect(job?.payload).not.toHaveProperty('sensitive');
 }finally{await f.close();}
});
it('queues same-repository pull request updates and ignores Repopay check-run recursion',async()=>{
 const f=await createTestDatabase();try{
  await migrateDatabase(f.database);
  const pull={action:'synchronize',installation:{id:1},repository:{id:2},pull_request:{number:42,base:{repo:{id:2}}}};
  const raw=Buffer.from(JSON.stringify(pull));await ingestGitHub(f.database,secret,3,raw,{...signed(raw),event:'pull_request'});
  const [job]=await f.database.orm.select().from(jobs);expect(job?.kind).toBe('sync_pull_request');expect(job?.payload).toMatchObject({repoId:'2',prNumber:42});
  const check={action:'completed',installation:{id:1},repository:{id:2},check_run:{head_sha:'a'.repeat(40),app:{id:testEnv.GH_APP_ID}}};
  const checkRaw=Buffer.from(JSON.stringify(check));await ingestGitHub(f.database,secret,3,checkRaw,{...signed(checkRaw,'our-check'),event:'check_run'},testEnv.GH_APP_ID);
  expect(await f.database.orm.select().from(jobs)).toHaveLength(1);
 }finally{await f.close();}
});
it('signed PR contribution commands retain explicit revision identity; edits, quotes and bots are ignored',async()=>{
 const f=await createTestDatabase();try{await migrateDatabase(f.database);
 const body=`/bounty contribute #11 ${'a'.repeat(40)} ${'b'.repeat(40)} Implemented array validation`;
 const payload={...event,issue:{number:12,pull_request:{}},comment:{...event.comment,body}};
 const raw=Buffer.from(JSON.stringify(payload));await ingestGitHub(f.database,secret,3,raw,signed(raw,'claim'));
 await ingestGitHub(f.database,secret,3,raw,signed(raw,'claim-redelivery'));
 for(const [i,p] of [{...payload,action:'edited'},{...payload,comment:{...payload.comment,body:'> '+body}},{...payload,comment:{...payload.comment,user:{id:4,type:'Bot'}}}].entries()){
  const raw=Buffer.from(JSON.stringify(p));await ingestGitHub(f.database,secret,3,raw,signed(raw,'ignored-claim-'+String(i)));
 }
 const rows=await f.database.orm.select().from(jobs);expect(rows).toHaveLength(1);expect(rows[0]?.payload).toMatchObject({isPullRequest:true,actorId:'4',command:{kind:'contribute',headSha:'a'.repeat(40),baseSha:'b'.repeat(40)}});
 }finally{await f.close();}
});

it.each(['/bounty retry #11','/bounty status #11'])('accepts new signed PR command %s but ignores edits and bots',async(body)=>{
 const f=await createTestDatabase();try{await migrateDatabase(f.database);
 const payload={...event,issue:{number:12,pull_request:{}},comment:{...event.comment,body}};
 const raw=Buffer.from(JSON.stringify(payload));await ingestGitHub(f.database,secret,3,raw,signed(raw,'command'));
 await ingestGitHub(f.database,secret,3,raw,signed(raw,'redelivery'));
 for(const [i,p] of [{...payload,action:'edited'},{...payload,comment:{...payload.comment,user:{id:4,type:'Bot'}}}].entries()){const data=Buffer.from(JSON.stringify(p));await ingestGitHub(f.database,secret,3,data,signed(data,'ignored-'+String(i)));}
 const rows=await f.database.orm.select().from(jobs);expect(rows).toHaveLength(1);expect(rows[0]?.payload).toMatchObject({isPullRequest:true,actorId:'4',command:{issueNumber:11}});
 }finally{await f.close();}
});
