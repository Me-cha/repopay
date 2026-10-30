import {expect,it} from 'vitest';
import {eq} from 'drizzle-orm';
import {awardFixture} from '../helpers/awards.js';
import {createReviewService} from '../../src/actions/approve.js';
import {authorizeAction} from '../../src/actions/guards.js';
import {actionTokens,awards,bounties,reviewDecisions,submissions,verifications} from '../../src/db/schema.js';
import {csrfFrom,form,required} from '../helpers/auth.js';
async function setup(){const f=await awardFixture();const sub=await f.add('20','2026-10-30T01:00:00Z');await f.database.orm.update(bounties).set({status:'NEEDS_REVIEW'}).where(eq(bounties.id,f.bounty.id));const session=await f.auth.requireSession(f.login.cookie);const service=createReviewService(f.database,f.env,{scan:f.scan,authorize:(s,b)=>authorizeAction(f.auth,f.api,s,b,'review'),profileAccepted:()=>Promise.resolve(true)});return {...f,sub,session,review:service};}
it('manual partial approval requires reason, binds full cents and concurrent confirmation creates one award',async()=>{const f=await setup();try{
 const v=required((await f.database.orm.select().from(verifications))[0]);await f.database.orm.update(verifications).set({result:{...required(v.result),verdict:'PARTIAL'}}).where(eq(verifications.id,v.id));
 await expect(f.review.issueApproveToken(f.session,f.bounty.id,'')).rejects.toThrow();
 const token=await f.review.issueApproveToken(f.session,f.bounty.id,'Maintainer verified the remaining requirement','8');
 expect((await f.review.confirmation(f.session,token)).params.allocation).toEqual([{ghId:'8',login:'fixture-author',cents:5000}]);
 const outcomes=await Promise.allSettled([f.review.approve(f.session,token),f.review.approve(f.session,token)]);expect(outcomes.filter(o=>o.status==='fulfilled')).toHaveLength(1);
 expect(await f.database.orm.select().from(awards)).toHaveLength(1);expect(await f.database.orm.select().from(reviewDecisions)).toHaveLength(1);expect((await f.database.orm.select().from(bounties))[0]?.status).toBe('AWAITING_CLAIM');
 }finally{await f.close();}});
it('permission loss, stale evidence, missing merge and unknown recipient cannot approve',async()=>{const f=await setup();try{
 await expect(f.review.issueApproveToken(f.session,f.bounty.id,'reason','999')).rejects.toThrow();
 const token=await f.review.issueApproveToken(f.session,f.bounty.id,'reason','8');f.permissions.write=false;await expect(f.review.approve(f.session,token)).rejects.toThrow();f.permissions.write=true;
 await f.database.orm.update(submissions).set({evidenceVersion:2}).where(eq(submissions.id,f.sub.id));await expect(f.review.approve(f.session,token)).rejects.toThrow();
 await f.database.orm.update(submissions).set({status:'OPEN',mergedAt:null}).where(eq(submissions.id,f.sub.id));await expect(f.review.preview(f.session,f.bounty.id)).rejects.toThrow();expect(await f.database.orm.select().from(awards)).toHaveLength(0);
 }finally{await f.close();}});
it('manual approval cannot override required CI or unverified authors',async()=>{const f=await setup();try{
 const scan=await f.scan(),fresh=required(scan.evidence.get(f.sub.id));fresh.ci.status='fail';await expect(f.review.issueApproveToken(f.session,f.bounty.id,'override CI','8')).rejects.toThrow();fresh.ci.status='pass';fresh.unverifiedAuthors=['99'];await expect(f.review.issueApproveToken(f.session,f.bounty.id,'override identity','8')).rejects.toThrow();
 }finally{await f.close();}});
it('rejection preserves evidence and lets the next merged candidate win without rejecting it on replay',async()=>{const f=await setup();try{
 const next=await f.add('21','2026-10-30T02:00:00Z');await f.review.reject(f.session,f.bounty.id,f.sub.id,'Does not meet criteria');await expect(f.review.reject(f.session,f.bounty.id,f.sub.id,'repeat')).rejects.toThrow();
 expect(await f.database.orm.select().from(submissions)).toHaveLength(2);const result=await f.service.settleBounty(f.bounty.id);expect(result?.kind).toBe('awarded');expect((await f.database.orm.select().from(awards))[0]?.submissionId).toBe(next.id);
 await expect(f.review.reject(f.session,f.bounty.id,next.id,'late')).rejects.toThrow();
 }finally{await f.close();}});
it('automatic and manual settlement racing cannot commit two awards',async()=>{const f=await setup();try{
 const token=await f.review.issueApproveToken(f.session,f.bounty.id,'verified','8');await Promise.allSettled([f.review.approve(f.session,token),f.service.settleBounty(f.bounty.id)]);expect(await f.database.orm.select().from(awards)).toHaveLength(1);
 }finally{await f.close();}});

it('confirmation shows bound recipients and rejects POST allocation substitution and cross-origin requests',async()=>{const f=await setup();try{
 const token=await f.review.issueApproveToken(f.session,f.bounty.id,'reviewed','8'),path='/review/'+token;
 const page=await f.request(path);expect(page.status).toBe(200);const html=await page.text();expect(html).toContain('50.00');expect(html).toContain('fixture-author');const csrf=csrfFrom(html);
 expect((await f.request(path,form(csrf,{recipient:'999'}))).status).toBe(400);
 const bad=form(csrf);bad.headers.Origin='https://evil.test';expect((await f.request(path,bad)).status).toBe(403);
 expect(await f.database.orm.select().from(awards)).toHaveLength(0);
 }finally{await f.close();}});
it('expired tokens, funding holds and revised reviewer output invalidate a confirmation',async()=>{const f=await setup();try{
 const token=await f.review.issueApproveToken(f.session,f.bounty.id,'reviewed','8');await f.database.orm.update(actionTokens).set({expiresAt:new Date(0)});await expect(f.review.approve(f.session,token)).rejects.toThrow();
 const fresh=await f.review.issueApproveToken(f.session,f.bounty.id,'reviewed','8');await f.database.orm.update(bounties).set({fundingHold:true});await expect(f.review.approve(f.session,fresh)).rejects.toThrow();await f.database.orm.update(bounties).set({fundingHold:false});
 const v=required((await f.database.orm.select().from(verifications))[0]);await f.database.orm.insert(verifications).values({submissionId:v.submissionId,evidenceId:v.evidenceId,headSha:v.headSha,attempt:2,status:'ERROR',provider:'copilot',model:v.model,sdkVersion:v.sdkVersion,sponsorGhId:v.sponsorGhId,promptHash:v.promptHash});await expect(f.review.approve(f.session,fresh)).rejects.toThrow();
 expect(await f.database.orm.select().from(awards)).toHaveLength(0);
 }finally{await f.close();}});
it('comment rejection is revision-targeted and a repeated leased job cannot reject the next candidate',async()=>{
 const f=await setup();try{
  const {enqueue,claimJob}=await import('../../src/jobs/queue.js');
  const {githubId}=await import('../../src/domain/types.js');
  await f.add('21','2026-10-30T02:00:00Z');
  await f.database.withTransaction(tx=>enqueue(tx,{kind:'run_command',payload:{installationId:'1',repoId:'2',issueNumber:12,commentId:'100',actorId:'4',command:{kind:'reject',reason:'Missing behavior'}},dedupeKey:'review-test',maxAttempts:3}));
  const lease=required(await claimJob(f.database,'review-test',60));
  const service=createReviewService(f.database,f.env,{scan:f.scan,authorize:(s,b)=>authorizeAction(f.auth,f.api,s,b,'review'),profileAccepted:()=>Promise.resolve(true),authorizeComment:()=>Promise.resolve({actorGhId:githubId('4'),source:'github_comment',authorization:{repoId:githubId('2'),action:'review',role:'maintainer',checkedAt:new Date()}})});
  await expect(service.rejectComment('4',f.bounty.id,'wrong PR',lease,21)).rejects.toThrow();
  await service.rejectComment('4',f.bounty.id,'Missing behavior',lease,20);
  await service.rejectComment('4',f.bounty.id,'Missing behavior',lease,20);
  expect(await f.database.orm.select().from(reviewDecisions)).toHaveLength(1);
 }finally{await f.close();}
});
