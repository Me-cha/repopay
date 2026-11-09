import { createServer } from 'node:http';
import nock from 'nock';
import { eq } from 'drizzle-orm';
import { createTestDatabase } from '../helpers/database.js';
import { syntheticEnv } from '../helpers/env.js';
import { migrateDatabase } from '../../src/db/migrate.js';
import { parseFundingEnv } from '../../src/env.js';
import { createAuth,type OAuthProvider } from '../../src/github/oauth.js';
import { createGitHub } from '../../src/github/app.js';
import { buildApp } from '../../src/http/routes.js';
import { bounties,bountyActivity,contributors,installations,fundingAttempts,cancellationRequests,actionTokens,submissions,submissionEvidence,verifications,awards,payoutBatches,payoutItems,userOnboarding } from '../../src/db/schema.js';
import { makeTerms,termsHash } from '../../src/domain/funded-terms.js';
import { encrypt,sha256 } from '../../src/util/crypto.js';
const f=await createTestDatabase();await migrateDatabase(f.database);
const env=parseFundingEnv({...syntheticEnv(),PUBLIC_URL:'http://127.0.0.1:4317',PORT:'4317',SSE_HEARTBEAT_SEC:'1',PP_MERCHANT_ID:'MERCHANT',POLICY_CI_CONTEXTS:'{"2":[{"name":"test","appId":"15368"}]}',CANCELLATION_OPERATOR_GH_IDS:'10'});
nock.disableNetConnect();nock.enableNetConnect(/^(localhost|127\.0\.0\.1)(:\d+)?$/);
let actor='4',access=true;
const provider:OAuthProvider={exchange:()=>Promise.resolve({accessToken:'test-'+actor,refreshToken:'refresh-'+actor,expiresIn:3600,refreshExpiresIn:7200}),refresh:()=>Promise.reject(new Error('Unexpected refresh')),identity:token=>Promise.resolve({id:token.slice(5),login:token==='test-4'?'maintainer':token==='test-8'?'contributor':'operator'}),repository:()=>Promise.resolve({id:'2',read:access,write:actor==='4',admin:actor==='4',ownerId:'4',ownerType:'User'})};
const github={...createGitHub(env),installation:()=>Promise.resolve({id:'1',app_id:env.GH_APP_ID,account:{id:'4',login:'maintainer'},suspended_at:null}),repository:()=>Promise.resolve({id:'2',full_name:'demo/repo',archived:false}),permission:()=>Promise.resolve(access?'read' as const:'none' as const),comments:()=>Promise.resolve([]),pullRequests:()=>Promise.resolve({pulls:[],complete:true})};
const auth=createAuth(f.database,env,provider),app=buildApp({database:f.database,version:'e2e',authentication:{database:f.database,env,auth,github},funding:{env,listCopilotModels:()=>Promise.resolve([])}});
await f.database.orm.insert(installations).values({id:'1',accountId:'4',accountLogin:'maintainer'});
for(const [index,status] of ['OPEN','CAPTURING','FUNDED','NEEDS_REVIEW','AWAITING_CLAIM','PAYING','PAID','REFUNDING','CANCELLED','FUNDED'].entries()){
 const [b]=await f.database.orm.insert(bounties).values({id:String(index+1),installationId:'1',repoId:'2',repoFullName:'demo/repo',issueNumber:index+1,amountCents:5000,createdByGhId:'4',createdVia:'command',status,needsAttention:['NEEDS_REVIEW','PAYING','REFUNDING'].includes(status),attentionReason:status==='PAYING'?'Payment pending; reconcile the existing transfer':null}).returning();if(!b)throw new Error('Seed failed');
 const terms=makeTerms(env,b,{title:index===9?'<img src=x onerror="window.injected=true">':'Parser issue '+String(index+1),body:'Reject malformed input and keep valid form encoding unchanged.',updatedAt:'2026-10-30T00:00:00Z'},{sponsorGhId:'4',sponsorLogin:'maintainer',modelId:env.COPILOT_MODEL,revokedAt:null});
 if(index>=2)await f.database.orm.update(bounties).set({fundedTerms:terms,fundedAt:new Date(),captureId:'CAPTURE'+String(index)}).where(eq(bounties.id,b.id));

 if(index>=3&&index<=6){
 const [sub]=await f.database.orm.insert(submissions).values({bountyId:b.id,repoId:'2',prId:String(100+index),prNumber:100+index,authorGhId:'8',authorLogin:'contributor',status:'MERGED',headSha:'a'.repeat(40),baseSha:'b'.repeat(40),mergeSha:'c'.repeat(40),mergedAt:new Date(),evidenceVersion:1}).returning();if(!sub)throw new Error('Missing submission');
 const [ev]=await f.database.orm.insert(submissionEvidence).values({submissionId:sub.id,version:1,headSha:sub.headSha,baseSha:sub.baseSha,title:'Parser fix',body:'Fix malformed input',diffText:'Validated parser change',inputTruncated:false,evidenceSufficient:true,eligibleAuthors:[{ghId:'8',login:'contributor'}],unverifiedAuthors:[],ci:{status:'pass'},snapshotHash:'d'.repeat(64)}).returning();if(!ev)throw new Error('Missing evidence');
 const [v]=await f.database.orm.insert(verifications).values({submissionId:sub.id,evidenceId:ev.id,headSha:sub.headSha,attempt:1,status:'DONE',provider:'copilot',model:'test-model',sdkVersion:'1.0.28',sponsorGhId:'4',promptHash:'f'.repeat(64),result:{verdict:index===3?'PARTIAL':'RESOLVES',confidence:0.95,coverage:index===3?0.5:1,reasoning:index===3?'Malformed input is rejected, but the empty-body regression is missing.':'Both required parser cases are covered.',unmet_requirements:index===3?['Add the empty-body regression test.']:[],splits:[{gh_id:'8',share:1,why:'PR author'}]}}).returning();if(!v)throw new Error('Missing verification');
 if(index>=4){const [award]=await f.database.orm.insert(awards).values({bountyId:b.id,submissionId:sub.id,evidenceId:ev.id,verificationId:v.id,headSha:sub.headSha,baseSha:sub.baseSha,mergeSha:'c'.repeat(40),mergedAt:new Date(),scanHash:'a'.repeat(64),amountCents:5000,allocation:[{ghId:'8',login:'contributor',cents:5000}]}).returning();if(!award)throw new Error('Missing award');if(index>=5){const [batch]=await f.database.orm.insert(payoutBatches).values({awardId:award.id,senderBatchId:'batch-'+b.id,accountHash:'account-test'}).returning();if(!batch)throw new Error('Missing batch');await f.database.orm.insert(payoutItems).values({batchId:batch.id,awardId:award.id,ghId:'8',amountCents:5000,senderItemId:'item-'+b.id,destinationEnc:'encrypted-test-only',connectionVersion:1,status:index===6?'SUCCESS':'FAILED'});}}
 }
 await f.database.orm.insert(bountyActivity).values({bountyId:b.id,actorGhId:'4',source:'e2e',action:'fixture_'+status.toLowerCase()});
 if(index===1){const [attempt]=await f.database.orm.insert(fundingAttempts).values({bountyId:b.id,attemptNumber:1,actorGhId:'4',checkoutOrigin:env.PUBLIC_URL,terms,termsHash:termsHash(terms),amountCents:5000,status:'PENDING',orderRequestKey:'order-e2e',captureRequestKey:'capture-e2e'}).returning();if(attempt)await f.database.orm.update(bounties).set({currentFundingAttemptId:attempt.id}).where(eq(bounties.id,b.id));}
 if(index===2||index===7||index===8)await f.database.orm.insert(cancellationRequests).values({bountyId:b.id,requesterId:'4',funderId:'4',claimants:['8'],reasonCategory:'independent_fix',reason:'Independent earlier fix presented for operator review.',links:[],noticeHours:72,status:index===8?'COMPLETED':index===7?'EXECUTING':'NOTICE'});
}
await f.database.orm.insert(contributors).values({ghId:'8',ghLogin:'contributor',paypalEmailEnc:encrypt('recipient@example.test',env.PAYMENT_DATA_ENC_KEY,'contributor:8:paypal-email:v1')});
await f.database.orm.insert(actionTokens).values({tokenHash:sha256('eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'),bountyId:'1',action:'cancel_draft',params:{},bountyVersion:0,requestedByGhId:'4',expiresAt:new Date(Date.now()-1000)});
// Test-only routes live only in this isolated harness, never production build.
app.get('/_test/login/:role',async(req,res)=>{actor=req.params.role==='tour'&&typeof req.query.user==='string'&&/^9\d{3}$/.test(req.query.user)?req.query.user:req.params.role==='contributor'?'8':req.params.role==='operator'?'10':'4';access=true;if(req.params.role!=='tour')await f.database.orm.insert(userOnboarding).values({ghId:actor}).onConflictDoNothing();const start=new URL(await auth.beginLogin('/dashboard/','test-binding')),login=await auth.completeLogin('test-code',start.searchParams.get('state')??'','test-binding');res.setHeader('Set-Cookie','repopay_session='+login.cookie+'; Path=/; HttpOnly; SameSite=Lax');res.redirect('/dashboard/');});
app.post('/_test/revoke',async(_req,res)=>{access=false;await f.database.orm.insert(bountyActivity).values({bountyId:'3',source:'test',action:'access_changed'});res.json({ok:true});});
app.get('/_test/ready',(_req,res)=>{res.json({ready:true});});
const server=createServer(app);server.listen(4317,'127.0.0.1');
let closing=false;const close=()=>{if(closing)return;closing=true;server.closeAllConnections();server.close(()=>{void f.close().then(()=>{nock.enableNetConnect();process.exit(0);});});};process.on('SIGTERM',close);process.on('SIGINT',close);
