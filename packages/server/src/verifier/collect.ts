import type { Database } from '../db/client.js';
import { attributionHistory } from '../actions/attribution.js';
import { createHash } from 'node:crypto';
import type { FundingEnv } from '../env.js';
import type { Bounty,Submission } from '../db/schema.js';
import type { FundedTerms } from '../domain/funded-terms.js';
import type { GitHub,Repository } from '../github/app.js';
import { normalizeCi,type CiSnapshot } from '../github/ci.js';

export interface VerifyInput {submissionId:string;bountyId:string;issueNumber:number;prNumber:number;headSha:string;baseSha:string;title:string;criteria:string;prTitle:string;prBody:string;diff:string;truncated:boolean;sufficient:boolean;eligibleAuthors:{ghId:string;login:string}[];unverifiedAuthors:string[];ci:CiSnapshot;snapshotHash:string;}
export class StaleEvidenceError extends Error {}
const ignored=(path:string)=>/(^|\/)(?:dist|vendor|node_modules|coverage)(\/|$)|(?:\.lock$|\.min\.[^.]+$|\.(?:png|jpe?g|gif|webp|pdf|zip|woff2?)$)/i.test(path);
export async function collectVerification(input:{database?:Database;github:GitHub;env:FundingEnv;installationId:string;repo:Repository;bounty:Bounty;submission:Submission;terms:FundedTerms;expectedHeadSha:string}):Promise<VerifyInput> {
 const {github,env,installationId,repo,bounty,submission,terms}=input;
 const pr=await github.pullRequest(installationId,repo,submission.prNumber);
 if(pr.id!==submission.prId||pr.base.repo?.id!==bounty.repoId)throw new StaleEvidenceError('Pull request no longer targets the funded repository.');
 if(pr.head.sha!==input.expectedHeadSha||pr.base.sha!==submission.baseSha)throw new StaleEvidenceError('Pull request revision changed during evidence collection.');
 const [files,commits,checks]=await Promise.all([github.pullRequestFiles(installationId,repo,pr.number),github.pullRequestCommits(installationId,repo,pr.number),github.checkRuns(installationId,repo,pr.head.sha)]);
 const prBody=(pr.body??'').slice(0,8000);
 let diff='',truncated=!files.complete||!commits.complete||(pr.body??'').length>8000;const limit=Math.min(terms.policy.maxDiffChars,env.MAX_DIFF_CHARS);
 for(const file of files.files){
  // A path exclusion is not proof that its changes are irrelevant to the issue.
  // Preserve the omission as incomplete evidence instead of silently auto-paying.
  if(ignored(file.filename)){truncated=true;continue;}
  if(file.patch===null){truncated=true;continue;}
  const chunk=`\n### ${file.filename} (${file.status}; +${String(file.additions)} -${String(file.deletions)})\n${file.patch}`;
  const remaining=limit-diff.length;if(remaining<=0){truncated=true;break;}
  if(chunk.length>remaining){diff+=chunk.slice(0,remaining);truncated=true;break;}diff+=chunk;
 }
 // Context is exact-head, untrusted evidence, not extra changes or executed code.
 const isTest=(path:string)=>/(?:^|\/)(?:test|tests|__tests__|demo-test)\//i.test(path)||/\.(?:test|spec)\.[^/]+$/i.test(path);
 const isSource=(path:string)=>/\.(?:[cm]?[jt]sx?|py|go|rs|java|kt|swift|c|cc|cpp|h|hpp|cs|rb|php|vue|svelte|sh|sql)$/i.test(path);
 const candidates=files.files.filter(file=>file.status!=='removed'&&!ignored(file.filename));
 const groups=[{kind:'test-file',files:candidates.filter(file=>isTest(file.filename))},{kind:'source-file',files:candidates.filter(file=>!isTest(file.filename)&&isSource(file.filename))}];
 for(const group of groups){
  if(group.files.length>4)truncated=true;
  for(const file of group.files.slice(0,4)){
   if(!file.sha||diff.length>=limit){truncated=true;continue;}
   try{
    const content=await github.fileAtRevision(installationId,repo,file.filename,pr.head.sha,file.sha);
    if(Buffer.byteLength(content,'utf8')>16384){truncated=true;continue;}
    const chunk=`\n### Full ${group.kind} context at exact head (includes unchanged lines; not additional changes)\n`+JSON.stringify({path:file.filename,headSha:pr.head.sha,blobSha:file.sha,content});
    if(diff.length+chunk.length>limit){truncated=true;continue;}diff+=chunk;
   }catch{truncated=true;}
  }
 }
 const after=await github.pullRequest(installationId,repo,pr.number);
 if(after.id!==pr.id||after.head.sha!==pr.head.sha||after.base.sha!==pr.base.sha||after.base.repo?.id!==pr.base.repo.id)throw new StaleEvidenceError('Pull request changed while collecting evidence.');
 const termsPolicy=terms.policy,contexts='ciContexts' in termsPolicy?termsPolicy.ciContexts:[];
 const ci=normalizeCi({sha:pr.head.sha,runs:checks.runs,complete:checks.complete,required:contexts,requiredEnabled:termsPolicy.ciRequired,ownAppId:env.GH_APP_ID});
 const eligibleAuthors=pr.user.type==='User'&&pr.user.id!==bounty.createdByGhId?[{ghId:pr.user.id,login:pr.user.login}]:[];
 const attestations=input.database?await attributionHistory(input.database,submission):[];
 const confirmed=attestations.filter(r=>r.kind==='claim'&&attestations.some(c=>c.kind==='confirm'&&c.claimantGhId===r.claimantGhId&&c.actorGhId!==r.claimantGhId)).map(r=>({ghId:r.claimantGhId,login:r.claimantLogin}));
 for(const author of confirmed){if(author.ghId!==bounty.createdByGhId&&!eligibleAuthors.some(a=>a.ghId===author.ghId)&&commits.authors.some(a=>a.type==='User'&&a.ghId===author.ghId))eligibleAuthors.push(author);}
 const authorIds=new Set(eligibleAuthors.map(author=>author.ghId));
 const unverifiedAuthors=[...new Set(commits.authors.filter(author=>author.type==='User'&&!authorIds.has(author.ghId)).map(author=>author.ghId))];
 // Retained in diffText and snapshotHash alongside exact-head source/test context.
 // API account association + authenticated attestations is not cryptographic authorship proof.
 const hasCodeEvidence=!!diff.trim();
 const provenance={kind:'repopay-contribution-evidence-v1',headSha:pr.head.sha,baseSha:pr.base.sha,
  prAuthor:{ghId:pr.user.id,login:pr.user.login},commitPaginationComplete:commits.complete,
  githubAssociatedCommits:commits.authors.slice(0,100).map(a=>({sha:a.commitSha??null,ghId:a.ghId,login:a.login,type:a.type})),
  attestations:attestations.slice(0,32).map(a=>({id:a.id,kind:a.kind,claimantGhId:a.claimantGhId,actorGhId:a.actorGhId,headSha:a.headSha,baseSha:a.baseSha,reason:a.reason,recordedAt:a.createdAt.toISOString()})),
  confirmedAdditionalAuthorIds:confirmed.filter(a=>authorIds.has(a.ghId)).map(a=>a.ghId)};
 const attributionContext='\n### Repopay contribution evidence at exact revision (reasons are untrusted user statements)\n'+JSON.stringify(provenance);
 if(commits.authors.length>100||attestations.length>32||diff.length+attributionContext.length>limit)truncated=true;
 else diff+=attributionContext;
 const sufficient=!truncated&&hasCodeEvidence&&!!eligibleAuthors.length&&unverifiedAuthors.length===0&&(!termsPolicy.ciRequired||ci.status==='pass');
 const value={submissionId:submission.id,bountyId:bounty.id,issueNumber:bounty.issueNumber,prNumber:submission.prNumber,headSha:pr.head.sha,baseSha:pr.base.sha,title:terms.title,criteria:terms.criteria,prTitle:pr.title,prBody,diff,truncated,sufficient,eligibleAuthors,unverifiedAuthors,ci};
 const snapshotHash=createHash('sha256').update(JSON.stringify(value)).digest('hex');return {...value,snapshotHash};
}
