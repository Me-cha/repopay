import { afterEach,describe,expect,it } from 'vitest';
import { contributors,jobs } from '../../src/db/schema.js';
import { authFixture,csrfFrom,form } from '../helpers/auth.js';
import { decrypt } from '../../src/util/crypto.js';

describe('contributor payout connection',()=>{
 let f:Awaited<ReturnType<typeof authFixture>>|undefined;
 afterEach(async()=>{await f?.close();f=undefined;});
 it('stores the signed-in GitHub identity and encrypts the payout email',async()=>{
  f=await authFixture();const response=await f.request('/connect',{method:'GET'});const html=await response.text();
  const saved=await f.request('/connect',form(csrfFrom(html),{paypalEmail:'payee@example.com'}));expect(saved.status).toBe(200);
  const [row]=await f.database.orm.select().from(contributors);expect(row?.ghId).toBe('4');expect(row?.ghLogin).toBe('maintainer');expect(row?.paypalEmailEnc).not.toContain('payee@example.com');
  expect(decrypt(row?.paypalEmailEnc??'',f.env.PAYMENT_DATA_ENC_KEY,'contributor:4:paypal-email:v1')).toBe('payee@example.com');
 });
 it('rejects invalid emails and requests without CSRF',async()=>{
  f=await authFixture();const page=await f.request('/connect'),csrf=csrfFrom(await page.text());
  const invalid=await f.request('/connect',form(csrf,{paypalEmail:'not an email'}));expect(invalid.status).toBe(400);
  const missing=await f.request('/connect',{method:'POST',headers:{Origin:'https://gitpay.test','Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({paypalEmail:'payee@example.com'}).toString()});expect(missing.status).toBe(403);
  expect(await f.database.orm.select().from(contributors)).toHaveLength(0);
 });
 it('uses stable GitHub ID when login changes and persists each claim resume revision',async()=>{
  f=await authFixture();let page=await f.request('/connect'),csrf=csrfFrom(await page.text());
  await f.request('/connect',form(csrf,{paypalEmail:'first@example.com'}));
  const [first]=await f.database.orm.select().from(contributors);expect(first?.connectionVersion).toBe(1);
  page=await f.request('/connect');csrf=csrfFrom(await page.text());await f.request('/connect',form(csrf,{paypalEmail:'second@example.com'}));
  const [row]=await f.database.orm.select().from(contributors);expect(row?.ghId).toBe('4');expect(row?.connectionVersion).toBe(2);
  const events=await f.database.orm.select().from(jobs);expect(events.filter(event=>event.kind==='retry_claims')).toHaveLength(2);
 });
});
