import { createHash } from 'node:crypto';
import type { FundingEnv } from '../env.js';
import type { Bounty,Submission } from '../db/schema.js';
import type { FundedTerms } from '../domain/funded-terms.js';
import type { GitHub,Repository } from '../github/app.js';
import { normalizeCi,type CiSnapshot } from '../github/ci.js';

export interface VerifyInput {submissionId:string;bountyId:string;issueNumber:number;prNumber:number;headSha:string;baseSha:string;title:string;criteria:string;prTitle:string;prBody:string;diff:string;truncated:boolean;sufficient:boolean;eligibleAuthors:{ghId:string;login:string}[];unverifiedAuthors:string[];ci:CiSnapshot;snapshotHash:string;}
export class StaleEvidenceError extends Error {}
const ignored=(path:string)=>/(^|\/)(?:dist|vendor|node_modules|coverage)(\/|$)|(?:\.lock$|\.min\.[^.]+$|\.(?:png|jpe?g|gif|webp|pdf|zip|woff2?)$)/i.test(path);
export async function collectVerification(input:{github:GitHub;env:FundingEnv;installationId:string;repo:Repository;bounty:Bounty;submission:Submission;terms:FundedTerms;expectedHeadSha:string}):Promise<VerifyInput> {
 const {github,env,installationId,repo,bounty,submission,terms}=input;
 const pr=await github.pullRequest(installationId,repo,submission.prNumber);
 if(pr.id!==submission.prId||pr.base.repo?.id!==bounty.repoId)throw new StaleEvidenceError('Pull request no longer targets the funded repository.');
 if(pr.head.sha!==input.expectedHeadSha||pr.base.sha!==submission.baseSha)throw new StaleEvidenceError('Pull request revision changed during evidence collection.');
 const [files,commits,checks]=await Promise.all([github.pullRequestFiles(installationId,repo,pr.number),github.pullRequestCommits(installationId,repo,pr.number),github.checkRuns(installationId,repo,pr.head.sha)]);
 const after=await github.pullRequest(installationId,repo,pr.number);
 if(after.id!==pr.id||after.head.sha!==pr.head.sha||after.base.sha!==pr.base.sha||after.base.repo?.id!==pr.base.repo.id)throw new StaleEvidenceError('Pull request changed while collecting evidence.');
 const prBody=(pr.body??'').slice(0,8000);
 let diff='',truncated=!files.complete||!commits.complete||(pr.body??'').length>8000;const limit=Math.min(terms.policy.maxDiffChars,env.MAX_DIFF_CHARS);
 for(const file of files.files){
  if(ignored(file.filename))continue;
  if(file.patch===null){truncated=true;continue;}
  const chunk=`\n### ${file.filename} (${file.status}; +${String(file.additions)} -${String(file.deletions)})\n${file.patch}`;
  const remaining=limit-diff.length;if(remaining<=0){truncated=true;break;}
  if(chunk.length>remaining){diff+=chunk.slice(0,remaining);truncated=true;break;}diff+=chunk;
 }
 const termsPolicy=terms.policy,contexts='ciContexts' in termsPolicy?termsPolicy.ciContexts:[];
 const ci=normalizeCi({sha:pr.head.sha,runs:checks.runs,complete:checks.complete,required:contexts,requiredEnabled:termsPolicy.ciRequired,ownAppId:env.GH_APP_ID});
 const eligibleAuthors=pr.user.type==='User'&&pr.user.id!==bounty.createdByGhId?[{ghId:pr.user.id,login:pr.user.login}]:[];
 const authorIds=new Set(eligibleAuthors.map(author=>author.ghId));
 const unverifiedAuthors=[...new Set(commits.authors.filter(author=>author.type==='User'&&!authorIds.has(author.ghId)).map(author=>author.ghId))];
 const sufficient=!truncated&&!!diff.trim()&&!!eligibleAuthors.length&&unverifiedAuthors.length===0&&(!termsPolicy.ciRequired||ci.status==='pass');
 const value={submissionId:submission.id,bountyId:bounty.id,issueNumber:bounty.issueNumber,prNumber:submission.prNumber,headSha:pr.head.sha,baseSha:pr.base.sha,title:terms.title,criteria:terms.criteria,prTitle:pr.title,prBody,diff,truncated,sufficient,eligibleAuthors,unverifiedAuthors,ci};
 const snapshotHash=createHash('sha256').update(JSON.stringify(value)).digest('hex');return {...value,snapshotHash};
}
