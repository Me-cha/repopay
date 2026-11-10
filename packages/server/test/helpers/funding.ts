import type { FundingPayment } from '../../src/domain/funding-payment.js';
import { vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { required } from './auth.js';
import { bounties,fundingAttempts } from '../../src/db/schema.js';
import { createFunding } from '../../src/settlement/funding.js';
import type { Orders,OrderSnapshot } from '../../src/paypal/orders.js';
import { authFixture } from './auth.js';
import { syntheticEnv } from './env.js';
import { parseFundingEnv } from '../../src/env.js';
import { makeTerms } from '../../src/domain/funded-terms.js';
import { authorizeAction } from '../../src/actions/guards.js';
import { prepareFunding,confirmFunding } from '../../src/actions/fund.js';
export const fundingEnv=()=>parseFundingEnv({...syntheticEnv(),PUBLIC_URL:'https://repopay.test',PP_MERCHANT_ID:'MERCHANT12345',POLICY_CI_CONTEXTS:JSON.stringify({'2':[{name:'test',appId:'15368'}]})});
export async function intentFixture(payment:FundingPayment={method:'paypal'}) {
 const env=fundingEnv();env.PP_CRYPTO_ENABLED=payment.method==='crypto';const f=await authFixture(undefined,env);const session=await f.auth.requireSession(f.login.cookie);
 const ctx=await authorizeAction(f.auth,f.api,session,f.bounty,'fund');
 const terms=makeTerms(env,f.bounty,{title:'Fix parser',body:'Must reject invalid input',updatedAt:'2026-10-28T00:00:00Z'},{sponsorGhId:'4',sponsorLogin:'maintainer',modelId:env.COPILOT_MODEL,revokedAt:null});
 const prepare=()=>prepareFunding(f.database,env,session,ctx,f.bounty,terms,()=>new Date(),payment);
 return {...f,env,session,ctx,terms,prepare,async start(){const token=await prepare();return confirmFunding(f.database,env,session,ctx,token);}};
}
export async function captureFixture(payment:FundingPayment={method:'paypal'}) {
 const f=await intentFixture(payment);const attempt=await f.start();
 let now=new Date();const clock={now:()=>now};
 const order:OrderSnapshot={id:'ORDER123',status:'CREATED',reference:`repopay:${attempt.id}`,customId:attempt.termsHash,merchantId:f.env.PP_MERCHANT_ID,amountCents:5000,currency:'USD',approvalUrl:'https://www.sandbox.paypal.com/checkoutnow?token=ORDER123',captures:[]};
 const api:Orders={createOrder:vi.fn(()=>Promise.resolve(structuredClone(order))),getOrder:vi.fn(()=>Promise.resolve(structuredClone(order))),captureOrder:vi.fn(()=>{order.status='COMPLETED';order.captures=[{id:'CAPTURE123',status:'COMPLETED',amountCents:5000,currency:'USD',finalCapture:true}];return Promise.resolve(structuredClone(order));}),getCapture:vi.fn(()=>Promise.resolve(required(order.captures[0])))};
 const service=createFunding(f.database,f.env,api,clock);
 return {...f,githubApi:f.api,attempt,order,api,service,clock,advance:(ms:number)=>{now=new Date(now.getTime()+ms);},get:async()=>required((await f.database.orm.select().from(fundingAttempts).where(eq(fundingAttempts.id,attempt.id)))[0]),getBounty:async()=>required((await f.database.orm.select().from(bounties).where(eq(bounties.id,f.bounty.id)))[0])};
}
