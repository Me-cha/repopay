import { expect,it } from 'vitest';
import { authFixture } from '../helpers/auth.js';
it('list_detail_same_scope; revoked_access_rechecked; no_raw_payment_destination_or_secret',async()=>{const f=await authFixture();try{
 const list=await f.request('/api/bounties');expect(list.status).toBe(200);const body=await list.text();expect(body).toContain('owner/repo');expect(body).not.toMatch(/accessToken|csrfSecret|paypalEmail|captureRequestKey/);
 f.permissions.read=false;expect((await f.request('/api/bounties/'+f.bounty.id)).status).toBe(403);const denied=await f.request('/api/bounties');expect(await denied.text()).not.toContain('owner/repo');
 }finally{await f.close();}});
it('guessed_private_bounty_denied; operator flag does not bypass scope; lists fail closed on provider outage',async()=>{const f=await authFixture();try{f.permissions.read=false;expect((await f.request('/api/bounties/'+f.bounty.id)).status).toBe(403);expect(await (await f.request('/api/payouts')).json()).toMatchObject({items:[]});f.permissions.fail=true;expect((await f.request('/api/bounties')).status).toBe(503);expect((await f.request('/api/stream?cursor=invalid')).status).not.toBe(200);}finally{await f.close();}});
