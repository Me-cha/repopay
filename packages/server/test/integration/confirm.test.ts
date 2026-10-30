import { detailSchema } from '../../src/read-models/contracts.js';
import { expect,it } from 'vitest';
import { eq } from 'drizzle-orm';
import { authFixture,csrfFrom,form,prepare,required } from '../helpers/auth.js';
import { actionTokens,bounties,bountyActivity } from '../../src/db/schema.js';
it('preview GET never changes the bounty or issues a token; unauthenticated access redirects to login',async()=>{
 const f=await authFixture();try{
 const path=`/bounties/${f.bounty.id}/cancel`;
 const response=await f.request(path);expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('no-store');expect(response.headers.get('referrer-policy')).toBe('no-referrer');expect(await response.text()).toContain('$50.00');
 expect(await f.database.orm.select().from(actionTokens)).toHaveLength(0);expect((await f.database.orm.select().from(bounties))[0]?.status).toBe('OPEN');
 expect((await f.request(path,{headers:{Cookie:''}})).headers.get('location')).toContain('/login?returnTo=');
 }finally{await f.close();}
});
it('concurrent double POST consumes token and cancels exactly once; lost response can be refreshed',async()=>{
 const f=await authFixture();try{
 const link=await prepare(f);const token=required(link.split('/').at(-1));const rows=await f.database.orm.select().from(actionTokens);expect(JSON.stringify(rows)).not.toContain(token);
 const csrf=csrfFrom(await(await f.request(link)).text());
 const responses=await Promise.all([f.request(link,form(csrf)),f.request(link,form(csrf))]);expect(responses.map(r=>r.status).sort()).toEqual([303,409]);
 expect((await f.database.orm.select().from(bounties))[0]?.status).toBe('CANCELLED');expect(await f.database.orm.select().from(bountyActivity)).toHaveLength(1);
 const result=await f.request('/api/bounties/'+f.bounty.id);expect(await result.json()).toMatchObject({status:'CANCELLED'});expect((await f.request(link)).status).toBe(409);
 }finally{await f.close();}
});
it('stale version and expired token cannot authorize cancellation',async()=>{
 const f=await authFixture();try{
 const link=await prepare(f);const csrf=csrfFrom(await(await f.request(link)).text());await f.database.orm.update(bounties).set({version:1});expect((await f.request(link,form(csrf))).status).toBe(409);
 const second=await prepare(f);const csrf2=csrfFrom(await(await f.request(second)).text());await f.database.orm.update(actionTokens).set({expiresAt:new Date('2000-01-01')});expect((await f.request(second,form(csrf2))).status).toBe(409);expect((await f.database.orm.select().from(bounties))[0]?.status).toBe('OPEN');
 }finally{await f.close();}
});
it('wrong action, missing CSRF and cross-origin requests do not consume the token',async()=>{
 const f=await authFixture();try{
 const link=await prepare(f);const csrf=csrfFrom(await(await f.request(link)).text());
 expect((await f.request(link,{method:'POST'})).status).toBe(403);
 expect((await f.request(link,{...form(csrf),headers:{...form(csrf).headers,Origin:'null'}})).status).toBe(403);
 expect((await f.request(link,{...form(csrf),headers:{...form(csrf).headers,Origin:'https://evil.example'}})).status).toBe(403);
 expect((await f.request(link,form(csrf,{action:'approve',amount:'1'}))).status).toBe(400);
 expect((await f.database.orm.select().from(actionTokens))[0]?.usedAt).toBeNull();
 }finally{await f.close();}
});
it('repository text is escaped and status DTO contains only approved public fields and no token data',async()=>{
 const f=await authFixture();try{
 await f.database.orm.update(bounties).set({repoFullName:'<img src=x onerror=alert(1)>'}).where(eq(bounties.id,f.bounty.id));
 const html=await(await f.request(`/bounties/${f.bounty.id}/cancel`)).text();expect(html).not.toContain('<img');expect(html).toContain('&lt;img');
 const dto:unknown=await(await f.request('/api/bounties/'+f.bounty.id)).json();if(!dto||typeof dto!=='object')throw new Error('Missing DTO');expect(detailSchema.strict().safeParse(dto).success).toBe(true);expect(JSON.stringify(dto)).not.toMatch(/accessToken|csrfSecret|paypalEmail|destinationEnc/);
 }finally{await f.close();}
});

it('expiry while waiting for the bounty lock rolls back cancellation and token use',async()=>{
 let now=new Date();const f=await authFixture({now:()=>now});const client=await f.database.pool.connect();
 try {
  const link=await prepare(f),csrf=csrfFrom(await(await f.request(link)).text());
  await client.query('BEGIN');await client.query('SELECT id FROM bounties WHERE id=$1 FOR UPDATE',[f.bounty.id]);
  const pending=f.request(link,form(csrf));
  await expect.poll(async()=>{const result=await f.database.pool.query<{n:number}>("SELECT count(*)::int AS n FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE '%bounties%' AND pid <> pg_backend_pid()");return Number(result.rows[0]?.n);}).toBeGreaterThan(0);
  now=new Date(now.getTime()+(f.env.ACTION_TOKEN_TTL_SEC+1)*1000);
  await client.query('COMMIT');expect((await pending).status).toBe(409);
  expect((await f.database.orm.select().from(bounties))[0]?.status).toBe('OPEN');expect((await f.database.orm.select().from(actionTokens))[0]?.usedAt).toBeNull();expect(await f.database.orm.select().from(bountyActivity)).toHaveLength(0);
 } finally {await client.query('ROLLBACK');client.release();await f.close();}
});

it('used and stale confirmation pages offer an authorized browser recovery path',async()=>{
 const f=await authFixture();try {
  const first=await prepare(f);const csrf=csrfFrom(await(await f.request(first)).text());
  await f.database.orm.update(bounties).set({version:1});const stale=await f.request(first);expect(stale.status).toBe(409);expect(await stale.text()).toContain(`href="/bounties/${f.bounty.id}/cancel"`);
  const link=await prepare(f),csrf2=csrfFrom(await(await f.request(link)).text());expect((await f.request(link,form(csrf2))).status).toBe(303);
  const replay=await f.request(link,form(csrf2));const html=await replay.text();expect(replay.status).toBe(409);expect(html).toContain(`href="/bounties/${f.bounty.id}"`);expect(html).toContain('CANCELLED');
  const reused=await f.request(link);expect(await reused.text()).toContain(`href="/bounties/${f.bounty.id}"`);
  f.permissions.read=false;f.permissions.write=false;const denied=await f.request(first,form(csrf));expect(denied.status).toBe(403);expect(await denied.text()).not.toContain('CANCELLED');
 }finally{await f.close();}
});
