import { expect,it,vi } from 'vitest';
import { intentFixture } from '../helpers/funding.js';
import { fundingAttempts,deliveries,jobs } from '../../src/db/schema.js';
import { createPayPalIntake } from '../../src/paypal/webhooks.js';
const headers={transmissionId:'transmission',transmissionTime:'2026-10-28T00:00:00Z',certUrl:'https://api.sandbox.paypal.com/v1/notifications/certs/CERT',authAlgo:'SHA256withRSA',transmissionSig:'signature'};
const event=Buffer.from(JSON.stringify({id:'EVENT123',event_type:'CHECKOUT.ORDER.APPROVED',resource:{id:'ORDER123'}}));
it('forged event has no mutation; verified duplicate stores one receipt and one reconciliation job',async()=>{
 const f=await intentFixture();try {
  await f.start();await f.database.orm.update(fundingAttempts).set({orderId:'ORDER123'});
  const verify=vi.fn(()=>Promise.resolve(false)),intake=createPayPalIntake(f.database,f.env,verify);
  await expect(intake(event,headers)).rejects.toMatchObject({status:401});expect(await f.database.orm.select().from(deliveries)).toHaveLength(0);
  verify.mockResolvedValue(true);await Promise.all([intake(event,headers),intake(event,headers)]);
  expect(await f.database.orm.select().from(deliveries)).toHaveLength(1);expect(await f.database.orm.select().from(jobs)).toHaveLength(1);
  expect((await f.database.orm.select().from(fundingAttempts))[0]?.captureSubmissionBoundaryAt).toBeNull();
 }finally{await f.close();}
});
it('verification outage is retryable and capture events schedule reads without trusting event status',async()=>{
 const f=await intentFixture();try {
  await f.start();await f.database.orm.update(fundingAttempts).set({orderId:'ORDER123',captureId:'CAPTURE123'});
  const verify=vi.fn(()=>Promise.reject(new Error('outage'))),intake=createPayPalIntake(f.database,f.env,verify);
  await expect(intake(event,headers)).rejects.toMatchObject({status:503});expect(await f.database.orm.select().from(deliveries)).toHaveLength(0);
  const good=createPayPalIntake(f.database,f.env,()=>Promise.resolve(true));
  await good(Buffer.from(JSON.stringify({id:'EVENT456',event_type:'PAYMENT.CAPTURE.COMPLETED',resource:{id:'CAPTURE123',status:'COMPLETED',supplementary_data:{related_ids:{order_id:'ORDER123'}}}})),headers);
  expect((await f.database.orm.select().from(fundingAttempts))[0]?.status).toBe('NEW');expect(await f.database.orm.select().from(jobs)).toHaveLength(1);
 }finally{await f.close();}
});
