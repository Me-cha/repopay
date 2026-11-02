import { expect,it } from 'vitest';
import { eq } from 'drizzle-orm';
import { authFixture,csrfFrom,form,prepare,required } from '../helpers/auth.js';
import { bounties,sessions } from '../../src/db/schema.js';
it('read-only user can read scoped status but cannot prepare cancellation',async()=>{
 const f=await authFixture();try{f.permissions.write=false;expect((await f.request('/api/bounties/'+f.bounty.id)).status).toBe(200);expect((await f.request(`/bounties/${f.bounty.id}/cancel`)).status).toBe(403);}finally{await f.close();}
});
it('revoked writer cannot confirm an earlier preview',async()=>{
 const f=await authFixture();try{const link=await prepare(f);const csrf=csrfFrom(await(await f.request(link)).text());f.permissions.write=false;expect((await f.request(link,form(csrf))).status).toBe(403);expect((await f.database.orm.select().from(bounties))[0]?.status).toBe('OPEN');}finally{await f.close();}
});
it('guessed or cross-repository IDs and unavailable permissions fail closed',async()=>{
 const f=await authFixture();try{expect((await f.request('/api/bounties/999999')).status).toBe(404);f.permissions.repoId='999';expect((await f.request('/api/bounties/'+f.bounty.id)).status).toBe(403);f.permissions.repoId='2';f.permissions.fail=true;expect((await f.request('/api/bounties/'+f.bounty.id)).status).toBe(503);}finally{await f.close();}
});
it('expired session cannot mutate and logout requires CSRF and Origin',async()=>{
 const f=await authFixture();try{
 const page=await f.request('/');const csrf=csrfFrom(await page.text());
 expect((await f.request('/logout',{method:'POST'})).status).toBe(403);
 expect((await f.request('/logout',{...form(csrf),headers:{...form(csrf).headers,Origin:'https://evil.example'}})).status).toBe(403);
 await f.database.orm.update(sessions).set({expiresAt:new Date('2000-01-01')}).where(eq(sessions.id,f.login.session.id));
 expect((await f.request(`/bounties/${f.bounty.id}/cancel`,form(csrf))).status).toBe(401);
 expect((await f.database.orm.select().from(bounties))[0]?.status).toBe('OPEN');
 }finally{await f.close();}
});
it('login callback rotates opaque cookies; successful logout invalidates them',async()=>{
 const f=await authFixture();try{
 const login=await f.request('/login?returnTo=%2F');expect(login.status).toBe(303);const location=new URL(required(login.headers.get('location')));const binding=required(required(login.headers.get('set-cookie')).split(';')[0]);
 expect(login.headers.get('set-cookie')).toContain('HttpOnly');expect(login.headers.get('set-cookie')).toContain('Secure');expect(login.headers.get('set-cookie')).toContain('SameSite=Lax');
 const callback='/oauth/github/callback?code=code&state='+encodeURIComponent(required(location.searchParams.get('state')));
 expect((await f.request(callback,{headers:{Cookie:'repopay_oauth=wrong'}})).status).toBe(400);
 const response=await f.request(callback,{headers:{Cookie:binding}});expect(response.status).toBe(303);const sessionCookie=required(required(response.headers.getSetCookie().find(v=>v.startsWith('repopay_session='))).split(';')[0]);
 const home=await f.request('/',{headers:{Cookie:sessionCookie}});const csrf=csrfFrom(await home.text());
 const logout=await f.request('/logout',{...form(csrf),headers:{...form(csrf).headers,Cookie:sessionCookie}});expect(logout.status).toBe(303);
 expect((await f.request('/api/bounties/'+f.bounty.id,{headers:{Cookie:sessionCookie}})).status).toBe(401);
 }finally{await f.close();}
});

it('browser logout invalidates locally without refreshing an expired provider token',async()=>{
 const f=await authFixture();try {
  const csrf=csrfFrom(await(await f.request('/')).text());
  await f.database.orm.update(sessions).set({accessExpiresAt:new Date('2000-01-01')});
  let refreshed=false;f.provider.refresh=()=>{refreshed=true;return Promise.reject(new Error('provider unavailable'));};
  const response=await f.request('/logout',form(csrf));expect(response.status).toBe(303);expect(refreshed).toBe(false);
  expect(await f.database.orm.select().from(sessions)).toHaveLength(0);expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
 } finally {await f.close();}
});
it('successful login replaces the old local session even if its provider token cannot refresh',async()=>{
 const f=await authFixture();try {
  await f.database.orm.update(sessions).set({accessExpiresAt:new Date('2000-01-01')});
  const login=await f.request('/login');const location=new URL(required(login.headers.get('location')));const binding=required(required(login.headers.get('set-cookie')).split(';')[0]);
  const response=await f.request('/oauth/github/callback?code=code&state='+encodeURIComponent(required(location.searchParams.get('state'))),{headers:{Cookie:binding+'; repopay_session='+f.login.cookie}});
  expect(response.status).toBe(303);const rows=await f.database.orm.select().from(sessions);expect(rows).toHaveLength(1);expect(rows[0]?.id).not.toBe(f.login.session.id);
 }finally{await f.close();}
});
