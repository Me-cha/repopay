import { vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { awardFixture } from './awards.js';
import { bounties,copilotSponsors,fundingAttempts,sessions,type CancellationBundle } from '../../src/db/schema.js';
import { createCancellation, type DecisionInput } from '../../src/cancellation/service.js';
import { cancellationCollector } from '../../src/cancellation/evidence.js';
import { createRefundSettlement } from '../../src/settlement/refund.js';
import { makeTerms,termsHash } from '../../src/domain/funded-terms.js';
import type { RefundSnapshot,Refunds } from '../../src/paypal/refunds.js';
import { createOrders } from '../../src/paypal/orders.js';
import { required } from './auth.js';
export async function cancellationFixture(realCollector=false){
 const f=await awardFixture();Object.assign(f.env,{COPILOT_MODEL:'auto',FUNDED_CANCELLATION_ENABLED:true,CANCELLATION_SANDBOX_REPO_ID:'2',CANCELLATION_OPERATOR_GH_IDS:['10']});
 const terms=makeTerms(f.env,f.bounty,{title:'Fix parser',body:'Must reject invalid input',updatedAt:'2026-10-28T00:00:00Z'},{sponsorGhId:'4',sponsorLogin:'maintainer',modelId:f.env.COPILOT_MODEL,revokedAt:null});
 await f.database.orm.update(copilotSponsors).set({modelId:'auto'});
 await f.database.orm.update(bounties).set({fundedTerms:terms,fundingActorGhId:'4'}).where(eq(bounties.id,f.bounty.id));
 await f.database.orm.insert(fundingAttempts).values({bountyId:f.bounty.id,attemptNumber:1,actorGhId:'4',checkoutOrigin:f.env.PUBLIC_URL,terms,termsHash:termsHash(terms),amountCents:5000,status:'COMPLETED',captureId:'CAPTURE',orderRequestKey:randomUUID(),captureRequestKey:randomUUID()});
 let now=new Date();const clock={now:()=>now};
 await f.database.orm.update(sessions).set({expiresAt:new Date(now.getTime()+30*86400000)});
 const stored=required((await f.database.orm.select().from(sessions))[0]);await f.database.orm.insert(sessions).values({...stored,id:'operator-session',ghId:'10',ghLogin:'operator'});
 const operator={...f.session,id:'operator-session',ghId:'10',ghLogin:'operator'};
 const access=vi.fn(()=>{if(f.state.permission==='none'||!f.state.installation)return Promise.reject(new Error('Access lost'));return Promise.resolve();});
 const bundle:CancellationBundle={complete:true,criteria:terms.criteria,claims:[]};f.api.cancellationReference=vi.fn(()=>Promise.resolve({independentFix:'predates all work'}));
 const collect=realCollector?cancellationCollector(f.database,f.api,f.env.MAX_DIFF_CHARS):vi.fn(()=>Promise.resolve(structuredClone(bundle)));
 const cancellation=createCancellation(f.database,f.env,{github:f.api,collect,access,clock});
 const snapshot:RefundSnapshot={id:'REFUND1',captureId:'CAPTURE',amountCents:5000,currency:'USD',status:'COMPLETED'};
 const provider:Refunds={submit:vi.fn(()=>Promise.resolve({...snapshot})),get:vi.fn(()=>Promise.resolve({...snapshot}))};
 const orders={...createOrders(f.env),getCapture:vi.fn(()=>Promise.resolve({id:'CAPTURE',status:'COMPLETED',amountCents:5000,currency:'USD',finalCapture:true}))};
 const refund=createRefundSettlement(f.database,f.env,cancellation,orders,provider);
 const input={reasonCategory:'independent_fix',reason:'An independently documented earlier fix resolves the original criteria.',links:['https://github.com/owner/repo/commit/'+'e'.repeat(40)]};
 const request=()=>cancellation.request(f.session,f.bounty.id,input);
 const plan:DecisionInput={decision:'approve',reason:'The independent earlier implementation predates all external work.',assessments:{},checklist:{independentFix:true,noCopiedWork:true,claimsAssessed:true,captureIdentified:true}};
 async function approved(){const r=await request();await cancellation.publish(r.id);now=new Date(now.getTime()+73*3600000);const token=await cancellation.prepare(operator,r.id,plan);await cancellation.decide(operator,token);return r;}
 return {...f,requestPage:f.request,providerIdentityForOperator(){f.provider.identity=()=>Promise.resolve({id:'10',login:'operator'});},async add(prId:string,at:string){f.env.COPILOT_MODEL='test-model';try{return await f.add(prId,at);}finally{f.env.COPILOT_MODEL='auto';}},clock,advance:(ms:number)=>{now=new Date(now.getTime()+ms);},operator,access,bundle,cancellation,refund,provider,orders,snapshot,request,input,plan,approved,getBounty:async()=>required((await f.database.orm.select().from(bounties).where(eq(bounties.id,f.bounty.id)))[0])};
}
