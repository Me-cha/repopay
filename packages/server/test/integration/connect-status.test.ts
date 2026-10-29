import { afterEach,describe,expect,it } from 'vitest';
import { contributors } from '../../src/db/schema.js';
import { authFixture,csrfFrom,form } from '../helpers/auth.js';
import { encrypt } from '../../src/util/crypto.js';

describe('private contributor connection status',()=>{
 let f:Awaited<ReturnType<typeof authFixture>>|undefined;
 afterEach(async()=>{await f?.close();f=undefined;});
 it('shows only the owner’s masked address and explains update scope',async()=>{
  f=await authFixture();await f.database.orm.insert(contributors).values({ghId:'4',ghLogin:'maintainer',paypalEmailEnc:encrypt('private@example.com',f.env.PAYMENT_DATA_ENC_KEY,'contributor:4:paypal-email:v1')});
  const page=await f.request('/connect'),html=await page.text();expect(page.status).toBe(200);expect(html).toContain('p•••@e•••.com');expect(html).not.toContain('private@example.com');expect(html).toContain('existing intents keep their saved destination');
  expect(html).toContain('for="paypalEmail"');expect(html).toContain('name="csrf"');
 });
 it('does not expose a different contributor’s payout address',async()=>{
  f=await authFixture();await f.database.orm.insert(contributors).values({ghId:'55',ghLogin:'another',paypalEmailEnc:encrypt('other-private@example.com',f.env.PAYMENT_DATA_ENC_KEY,'contributor:55:paypal-email:v1')});
  const page=await f.request('/connect');expect(await page.text()).not.toContain('other-private@example.com');
 });
 it('changes only the connection record; it has no payment side effect',async()=>{
  f=await authFixture();const page=await f.request('/connect');await f.request('/connect',form(csrfFrom(await page.text()),{paypalEmail:'new@example.com'}));
  expect(await f.database.orm.select().from(contributors)).toHaveLength(1);expect(f.api.createComment).not.toHaveBeenCalled();
 });
});
