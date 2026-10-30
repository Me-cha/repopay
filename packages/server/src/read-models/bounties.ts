import { and,desc,eq,gt,lt } from 'drizzle-orm';
import type { AuthenticationDependencies } from '../http/auth.js';
import { AuthError,type Session } from '../github/oauth.js';
import { findBounty,authorizeAction } from '../actions/guards.js';
import { awards,bounties,bountyActivity,cancellationRequests,cancellationDecisions,payoutItems,refundIntents,reviewDecisions,submissions,verifications,type Bounty } from '../db/schema.js';
import { verdictSchema } from '../verifier/schema.js';
import type { BountyDto,DetailDto,ReviewDto } from './contracts.js';
import { payoutRows } from './payouts.js';
export const pageSize=25;
export function cursor(value:unknown):string {if(value===undefined)return '0';if(typeof value!=='string'||!/^\d{1,19}$/.test(value)||BigInt(value)>9223372036854775807n)throw new AuthError(400,'Invalid page cursor.');return value;}
export function nextAction(b:Bounty):BountyDto['nextAction']{
 const issue=`https://github.com/${b.repoFullName}/issues/${String(b.issueNumber)}`;
 if(b.fundingHold)return {actor:'Operator',label:'Investigate funding hold; do not send another payment',href:issue};
 switch(b.status){
 case 'OPEN':return {actor:'Maintainer',label:'Review funding',href:`/bounties/${b.id}/fund`};
 case 'CAPTURING':return {actor:'Payment service',label:'Check saved checkout; capture is not yet confirmed',href:`/bounties/${b.id}/fund`};
 case 'FUNDED':return {actor:'Contributors',label:'Submit a solution in GitHub',href:issue};
 case 'NEEDS_REVIEW':return {actor:'Maintainer',label:'Review the merged solution',href:`/bounties/${b.id}/review`};
 case 'AWAITING_CLAIM':return {actor:'Awarded contributors',label:'Connect payout details; award is reserved',href:'/connect'};
 case 'PAYING':return {actor:'Payment service / operator',label:'Reconcile the existing payout; do not send a replacement',href:issue};
 case 'PAID':return {actor:'Contributors',label:'View delivered award in GitHub',href:issue};
 case 'REFUNDING':return {actor:'Operator',label:'Reconcile reserved refund; completion is not yet confirmed',href:issue};
 case 'CANCELLED':return {actor:'Maintainer',label:b.captureId?'Refund completed; view retained history':'Draft cancelled; no money moved',href:issue};
 default:return {actor:'Operator',label:'Inspect current status',href:issue};
 }
}
function reviewDto(v:typeof verifications.$inferSelect):ReviewDto{const result=verdictSchema.safeParse(v.result);return {id:v.id,status:v.status,headSha:v.headSha,verdict:result.success?result.data.verdict:null,confidence:result.success?result.data.confidence:null,coverage:result.success?result.data.coverage:null,reasoning:result.success?result.data.reasoning:'No valid verifier verdict is available.',unmetRequirements:result.success?result.data.unmet_requirements:[],errorCode:v.errorCode,createdAt:v.createdAt.toISOString()};}
export function readModels(deps:AuthenticationDependencies){
 const db=deps.database;
 async function access(session:Session,b:Bounty){await authorizeAction(deps.auth,deps.github,session,b,'read');}
 // Reuse current installation binding + current user-token repo checks. No
 // operator shortcut and no cross-request access cache. A provider outage fails
 // the whole page closed rather than returning an apparently authoritative list.
 async function candidates(session:Session,after='0'){
  const rows=await db.orm.select().from(bounties).where(gt(bounties.id,after)).orderBy(bounties.id).limit(pageSize+1),visible:Bounty[]=[];
  const permitted=new Map<string,boolean>();
  for(const b of rows.slice(0,pageSize)){const key=b.installationId+':'+b.repoId;let allow=permitted.get(key);if(allow===undefined){try{await access(session,b);allow=true;}catch(e){if(e instanceof AuthError&&[403,404].includes(e.status))allow=false;else throw e;}permitted.set(key,allow);}if(allow)visible.push(b);}
  return {rows:visible,nextCursor:rows.length>pageSize?rows[pageSize-1]?.id??null:null};
 }
 async function summary(b:Bounty):Promise<BountyDto>{
  const [award]=await db.orm.select().from(awards).where(eq(awards.bountyId,b.id));const items=award?await db.orm.select({cents:payoutItems.amountCents,status:payoutItems.status}).from(payoutItems).where(eq(payoutItems.awardId,award.id)):[];
  const [cancel]=await db.orm.select().from(cancellationRequests).where(eq(cancellationRequests.bountyId,b.id)).orderBy(desc(cancellationRequests.id)).limit(1);
  const [latest]=await db.orm.select({v:verifications}).from(verifications).innerJoin(submissions,eq(verifications.submissionId,submissions.id)).where(eq(submissions.bountyId,b.id)).orderBy(desc(verifications.id)).limit(1);
  const paidCents=items.filter(i=>i.status==='SUCCESS').reduce((n,i)=>n+i.cents,0);
  return {id:b.id,repoId:b.repoId,repoFullName:b.repoFullName,issueNumber:b.issueNumber,title:b.fundedTerms?.title??`Issue #${String(b.issueNumber)}`,amountCents:b.amountCents,currency:'USD',status:b.status,version:b.version,needsAttention:b.needsAttention,attentionReason:b.attentionReason,fundedAt:b.fundedAt?.toISOString()??null,githubUrl:`https://github.com/${b.repoFullName}/issues/${String(b.issueNumber)}`,createdByGhId:b.createdByGhId,nextAction:nextAction(b),cancellation:cancel?{id:cancel.id,stage:cancel.status,noticeEndsAt:cancel.noticeEndsAt?.toISOString()??null,nextUpdateAt:cancel.nextUpdateAt?.toISOString()??null}:null,award:award?{id:award.id,amountCents:award.amountCents,allocation:award.allocation,paidCents,unpaidCents:award.amountCents-paidCents}:null,latestReview:latest?reviewDto(latest.v):null};
 }
 async function list(session:Session,after:string){const page=await candidates(session,after);return {items:await Promise.all(page.rows.map(summary)),nextCursor:page.nextCursor};}
 async function detail(session:Session,id:string,before='9223372036854775807'):Promise<DetailDto>{
  const b=await findBounty(db,id);await access(session,b);const dto=await summary(b);
  const activity=await db.orm.select({id:bountyActivity.id,action:bountyActivity.action,actorGhId:bountyActivity.actorGhId,createdAt:bountyActivity.createdAt}).from(bountyActivity).where(and(eq(bountyActivity.bountyId,b.id),lt(bountyActivity.id,before))).orderBy(desc(bountyActivity.id)).limit(101);
  // Review histories are independent of the activity cursor: activity metadata is
  // deliberately excluded; financial keys, raw payloads and destinations never leave DB.
  const vs=await db.orm.select({v:verifications}).from(verifications).innerJoin(submissions,eq(verifications.submissionId,submissions.id)).where(eq(submissions.bountyId,b.id)).orderBy(desc(verifications.id));
  const reviews=await db.orm.select({id:reviewDecisions.id,kind:reviewDecisions.kind,actorGhId:reviewDecisions.actorGhId,reason:reviewDecisions.reason,createdAt:reviewDecisions.createdAt}).from(reviewDecisions).where(eq(reviewDecisions.bountyId,b.id)).orderBy(desc(reviewDecisions.id));
  const cancellations=await db.orm.select({id:cancellationDecisions.id,kind:cancellationDecisions.decision,actorGhId:cancellationDecisions.actorId,reason:cancellationDecisions.reason,createdAt:cancellationDecisions.createdAt}).from(cancellationDecisions).innerJoin(cancellationRequests,eq(cancellationRequests.id,cancellationDecisions.requestId)).where(eq(cancellationRequests.bountyId,b.id)).orderBy(desc(cancellationDecisions.id));
  const refunds=await db.orm.select({id:refundIntents.id,status:refundIntents.status,amountCents:refundIntents.amountCents,attention:refundIntents.attention}).from(refundIntents).where(eq(refundIntents.bountyId,b.id));
  return {...dto,criteria:b.fundedTerms?.criteria??'Criteria are frozen when this draft is funded.',verifications:vs.map(({v})=>reviewDto(v)),reviews:reviews.map(r=>({...r,createdAt:r.createdAt.toISOString()})),cancellationDecisions:cancellations.map(r=>({...r,createdAt:r.createdAt.toISOString()})),refunds,payouts:await payoutRows(db,b),activity:activity.slice(0,100).map(r=>({...r,createdAt:r.createdAt.toISOString()})),historyNextCursor:activity.length>100?activity[99]?.id??null:null};
 }
 return {access,candidates,summary,list,detail};
}
