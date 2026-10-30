import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { bounties,submissions,type Submission } from '../db/schema.js';
import type { FundingEnv } from '../env.js';
import type { GitHub } from '../github/app.js';
import { currentAccess } from '../github/permissions.js';
import { issueReferences } from '../github/linking.js';
import { linkPr } from '../actions/link.js';
import { collectVerification,type VerifyInput } from '../verifier/collect.js';

export interface CandidateScan {complete:boolean;bountyVersion:number;submissions:Submission[];evidence:Map<string,VerifyInput>;hash:string}
export function candidateFingerprint(rows:Submission[]):string {
 return createHash('sha256').update(JSON.stringify([...rows].sort((a,b)=>a.id<b.id?-1:1).map(r=>[r.id,r.prId,r.headSha,r.baseSha,r.mergeSha,r.status,r.mergedAt?.toISOString(),r.evidenceVersion]))).digest('hex');
}
export function candidateScanner(db:Database,github:GitHub,env:FundingEnv) {
 return async(bountyId:string):Promise<CandidateScan>=>{
  const [bounty]=await db.orm.select().from(bounties).where(eq(bounties.id,bountyId));if(!bounty?.fundedTerms)throw new Error('Funded terms required');
  const {repo}=await currentAccess(github,bounty.installationId,bounty.repoId);
  const before=await db.orm.select().from(submissions).where(eq(submissions.bountyId,bountyId));
  const listed=await github.pullRequests(bounty.installationId,repo);
  if(!listed.complete)return {complete:false,bountyVersion:bounty.version,submissions:before,evidence:new Map(),hash:candidateFingerprint(before)};
  const numbers=new Set(before.map(s=>s.prNumber));
  for(const pr of listed.pulls){
   const closing=await github.closingIssues(bounty.installationId,repo,pr.number);
   if(!closing.complete||closing.prId!==pr.id)return {complete:false,bountyVersion:bounty.version,submissions:before,evidence:new Map(),hash:candidateFingerprint(before)};
   if(closing.issueNumbers.includes(bounty.issueNumber)||issueReferences(`${pr.title}\n${pr.body??''}`,repo.full_name).includes(bounty.issueNumber))numbers.add(pr.number);
  }
  for(const number of numbers){const pr=await github.pullRequest(bounty.installationId,repo,number);await linkPr(db,bounty,pr);}
  const [current]=await db.orm.select().from(bounties).where(eq(bounties.id,bountyId));if(!current)throw new Error('Bounty unavailable');
  const rows=await db.orm.select().from(submissions).where(eq(submissions.bountyId,bountyId));
  const evidence=new Map<string,VerifyInput>();
  for(const sub of rows.filter(row=>row.status==='MERGED'))evidence.set(sub.id,await collectVerification({github,env,installationId:bounty.installationId,repo,bounty:current,submission:sub,terms:bounty.fundedTerms,expectedHeadSha:sub.headSha}));
  return {complete:true,bountyVersion:current.version,submissions:rows,evidence,hash:candidateFingerprint(rows)};
 };
}
