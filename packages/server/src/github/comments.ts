import { verdictSchema } from '../verifier/schema.js';
import { awardStatusText,cancellationStatusText } from '../actions/status.js';
import { and, eq, ne, sql, desc } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import type { GitHub, Repository } from './app.js';
import { bounties,submissions,awards,verifications,copilotSponsors,submissionEvidence } from '../db/schema.js';
import type { GitHubRuntimeEnv } from '../env.js';
import type { LeasedJob } from '../jobs/kinds.js';
import { assertLease } from '../jobs/queue.js';
import { attributionHistory } from '../actions/attribution.js';
import { currentAccess } from './permissions.js';
// A session advisory lock serializes external projection writes across workers.
// It deliberately holds no SQL transaction during GitHub requests.
export async function withProjectionLock<T>(db:Database,key:string,fn:()=>Promise<T>):Promise<T> {
 const client=await db.pool.connect();
 try {const result=await client.query<{locked:boolean}>('select pg_try_advisory_lock(hashtext($1)) as locked',[db.schemaName+':'+key]);if(!result.rows[0]?.locked)throw new Error('Projection busy');return await fn();}
 finally {try{await client.query('select pg_advisory_unlock(hashtext($1))',[db.schemaName+':'+key]);}finally{client.release();}}
}
async function upsert(github:GitHub,env:GitHubRuntimeEnv,inst:string,repo:Repository,number:number,marker:string,body:string) {
 const existing=(await github.comments(inst,repo,number)).find(c=>c.user.type==='Bot'&&c.performed_via_github_app?.id===env.GH_APP_ID&&c.body?.includes(marker));
 if(existing){await github.updateComment(inst,repo,existing.id,body);return existing.id;}
 return (await github.createComment(inst,repo,number,body)).id;
}
export async function reply(db:Database,github:GitHub,env:GitHubRuntimeEnv,job:LeasedJob,inst:string,repo:Repository,number:number,text:string) {
 return withProjectionLock(db,`reply:${job.id}`,async()=>{
  await db.withTransaction(tx=>assertLease(tx,job));
  const marker=`<!-- gitpay:reply:${job.id} -->`;await upsert(github,env,inst,repo,number,marker,marker+'\n'+text);
 });
}
export async function syncBounty(db:Database,github:GitHub,env:GitHubRuntimeEnv,job:LeasedJob,bountyId:string) {
 const [ref]=await db.orm.select({repoId:bounties.repoId,issueNumber:bounties.issueNumber}).from(bounties).where(eq(bounties.id,bountyId));if(!ref)return;
 // The badge is issue-scoped, so projections of every bounty on an issue serialize.
 await withProjectionLock(db,`issue:${ref.repoId}:${String(ref.issueNumber)}`,async()=>{
  await db.withTransaction(tx=>assertLease(tx,job));
  const [bounty]=await db.orm.select().from(bounties).where(eq(bounties.id,bountyId));if(!bounty)return;
  const {repo}=await currentAccess(github,bounty.installationId,bounty.repoId);
  const amount=`${String(Math.floor(bounty.amountCents/100))}.${String(bounty.amountCents%100).padStart(2,'0')}`;
  const marker=`<!-- gitpay:bounty:${bounty.id} -->`;
  const detail=awardStatusText(bounty.status,env.PUBLIC_URL)??(bounty.status==='CANCELLED'?(bounty.captureId?'Reviewed refund confirmed. Funding and contribution history are retained.':'Draft cancelled. No payment or refund was sent. History is retained.'):bounty.status==='OPEN'?`Draft or checkout pending. [Review funding](${new URL('/bounties/'+bounty.id+'/fund',env.PUBLIC_URL).href}) before starting a payment.\n\nAvailable: \`/bounty status\`, \`/bounty cancel\`. \`/bounty cancel\` cancels only an unfunded draft directly on this issue. Anyone may submit work; no assignment reserves a bounty.`:bounty.status==='FUNDED'?`Confirmed funding. The first qualifying merged PR wins under the frozen policy. Anyone may submit work; assignment reserves nothing. ${bounty.fundedTerms?.policy.fundedCancellationEnabled?'Exceptional cancellation requires independent review and notice.':'Funded cancellation is disabled in these terms.'}\n\nPolicy: ${bounty.fundedTerms?.policy.version??'stored terms'}; required CI: ${bounty.fundedTerms?.policy.ciContexts.map(c=>c.name+' (App '+c.appId+')').join(', ')||'no named contexts configured; see frozen CI policy'}. [View immutable criteria and funding status](${new URL('/bounties/'+bounty.id+'/fund',env.PUBLIC_URL).href}).${bounty.fundingHold?'\n\n**Funding hold: disbursement is frozen pending reconciliation.**':''}`:'Capture pending or unknown. Do not start another payment. Draft cancellation is unavailable.');
  const reviewLink=bounty.status==='NEEDS_REVIEW'?`\n\n[Review merged submission](${new URL('/bounties/'+bounty.id+'/review',env.PUBLIC_URL).href}). Review the full award before financial approval. Give rejection feedback directly on the PR; no merge is required to reject work.`:'';
  const [sponsor]=bounty.status==='OPEN'?await db.orm.select().from(copilotSponsors).where(eq(copilotSponsors.repoId,bounty.repoId)).limit(1):[];
  const owner=bounty.status==='OPEN'&&(!sponsor||sponsor.revokedAt)?`\n\n**Repository owner:** [Connect Copilot sponsor](${new URL('/bounties/'+bounty.id+'/copilot-sponsor',env.PUBLIC_URL).href}) before funding. Sign in with the repository owner account.`:'';
  const navigation=`\n\n[View bounty status](${new URL('/bounties/'+bounty.id,env.PUBLIC_URL).href}) · [View history and payment progress](${new URL('/dashboard/?bounty='+bounty.id,env.PUBLIC_URL).href})`;
  const participate=bounty.status==='FUNDED'?`\n\n**Contributors:** open a PR with \`Fixes #${String(bounty.issueNumber)}\` in its description. GitPay posts review results and next steps on that PR. Maintainers can comment or request changes before merge.`:'';
  const body=`${marker}\n**GitPay · $${amount} USD · ${bounty.status}**\n\n${detail}${owner}${participate}${reviewLink}${navigation}${await cancellationStatusText(db,bounty.id,env.PUBLIC_URL)}`;
  const commentId=await upsert(github,env,bounty.installationId,repo,bounty.issueNumber,marker,body);
  await db.withTransaction(async tx=>{await assertLease(tx,job);await tx.update(bounties).set({statusCommentId:commentId,repoFullName:repo.full_name,...(bounty.currentFundingAttemptId?{}:{needsAttention:false,attentionReason:null}),updatedAt:sql`now()`}).where(eq(bounties.id,bounty.id));});
  const [winner]=await db.orm.select({award:awards,prNumber:submissions.prNumber}).from(awards).innerJoin(submissions,eq(submissions.id,awards.submissionId)).where(eq(awards.bountyId,bounty.id));
  if(winner){
   const amounts=winner.award.allocation.map(a=>`@${safeMarkdown(a.login)}: $${(a.cents/100).toFixed(2)} USD`).join(' · ');
   const awardMarker=`<!-- gitpay:award:${winner.award.id} -->`;
   await upsert(github,env,bounty.installationId,repo,winner.prNumber,awardMarker,`${awardMarker}\n**GitPay award · ${bounty.status}**\n\n${amounts}\n\n${awardStatusText(bounty.status,env.PUBLIC_URL)??'Award recorded; inspect delivery status.'}${navigation}`);
  }
  // A cancelled draft must not clear the badge of its replacement on the same issue.
  const [replacement]=bounty.status==='CANCELLED'?await db.orm.select({id:bounties.id}).from(bounties).where(and(eq(bounties.repoId,bounty.repoId),eq(bounties.issueNumber,bounty.issueNumber),ne(bounties.status,'CANCELLED'))).limit(1):[];
  // Failure is retried after reconciliation of the already-written comment.
  if(!replacement)await github.badge(bounty.installationId,repo,bounty.issueNumber,bounty.status);
 });
}

function safeMarkdown(value:string){return value.replace(/[&<>`[\]]/g,'');}
export function contributionCommands(issue:number,head:string,base:string) {
 return `**Additional contributors:** post a new comment in this PR’s Conversation tab, replacing the reason:\n\n\`/bounty contribute #${String(issue)} ${head} ${base} Describe your actual contribution here\`\n\nThe bot will give a different maintainer the confirmation command. Both confirmations bind this head and base; changes require new confirmations. The PR author is already identified. These commands do not request a model review or move money.`;
}
export async function syncSubmission(db:Database,github:GitHub,env:GitHubRuntimeEnv,job:LeasedJob,id:string) {
 await withProjectionLock(db,`submission:${id}`,async()=>{
  await db.withTransaction(tx=>assertLease(tx,job));
  const [sub]=await db.orm.select().from(submissions).where(eq(submissions.id,id));if(!sub)return;
  const [bounty]=await db.orm.select().from(bounties).where(eq(bounties.id,sub.bountyId));if(!bounty)return;
  const {repo}=await currentAccess(github,bounty.installationId,bounty.repoId);
  const [review]=await db.orm.select().from(verifications).where(eq(verifications.submissionId,id)).orderBy(desc(verifications.id)).limit(1);
  const rows=await attributionHistory(db,sub);
  const claims=rows.filter(r=>r.kind==='claim').map(r=>`${safeMarkdown(r.claimantLogin)}: ${rows.some(c=>c.kind==='confirm'&&c.claimantGhId===r.claimantGhId)?'maintainer confirmed':'awaiting separate maintainer confirmation'}`).join('; ');
  const marker=`<!-- gitpay:submission:${id} -->`;
  const [snapshot]=review?await db.orm.select().from(submissionEvidence).where(eq(submissionEvidence.id,review.evidenceId)):[];
  const current=review?.headSha===sub.headSha&&snapshot?.baseSha===sub.baseSha&&snapshot.version===sub.evidenceVersion;
  const verdict=current&&review.status==='DONE'?verdictSchema.safeParse(review.result):undefined;
  const assessment=verdict?.success?`\n\n**${verdict.data.verdict}** · ${safeMarkdown(verdict.data.reasoning)}${verdict.data.unmet_requirements.length?'\n\nUnmet requirements:\n'+verdict.data.unmet_requirements.map(r=>'- '+safeMarkdown(r)).join('\n'):''}`:'';
  const status=current?`${review.status}${review.errorCode?' / '+review.errorCode:''}`:'Current revision awaits review';
  const body=`${marker}\n**GitPay · issue #${String(bounty.issueNumber)} · ${status}**${assessment}\n\nHead: \`${sub.headSha}\`. Base: \`${sub.baseSha}\`.\n\n[Read assessment, unmet requirements and CI](https://github.com/${repo.full_name}/pull/${String(sub.prNumber)}/checks) · [View bounty issue](https://github.com/${repo.full_name}/issues/${String(bounty.issueNumber)})\n\n${claims?'Contribution confirmations: '+claims+'\n\n':''}${sub.status==='OPEN'?contributionCommands(bounty.issueNumber,sub.headSha,sub.baseSha):'This PR is no longer open; new contributor confirmations are unavailable.'}\n\n**Maintainer:** request a fresh review here with \`/bounty retry #${String(bounty.issueNumber)} ${sub.headSha} ${sub.baseSha}\` after fixes and confirmations. Review attempts use the sponsor’s allowance. Anyone with repository access can post \`/bounty status #${String(bounty.issueNumber)}\` here for progress.\n\n**Maintainer:** give feedback or request changes on this PR. To reject the reviewed revision without merging, post \`/bounty reject #${String(bounty.issueNumber)} <reason>\`.${bounty.status==='NEEDS_REVIEW'?` [Review payment approval](${new URL('/bounties/'+bounty.id+'/review',env.PUBLIC_URL).href}).`:''} A review or contribution confirmation is not an award.\n\n**Repository owner:** [Manage Copilot sponsor](${new URL('/bounties/'+bounty.id+'/copilot-sponsor',env.PUBLIC_URL).href}) if reviews need authorization.`;
  await upsert(github,env,bounty.installationId,repo,sub.prNumber,marker,body);
 });
}
