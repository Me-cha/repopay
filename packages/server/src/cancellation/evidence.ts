import { eq } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { submissionEvidence,submissions,type Bounty,type CancellationBundle,type CancellationRequest } from '../db/schema.js';
import type { GitHub } from '../github/app.js';
import { currentAccess } from '../github/permissions.js';
import { sha256 } from '../util/crypto.js';
export type CollectEvidence=(bounty:Bounty,request:CancellationRequest)=>Promise<CancellationBundle>;
// Conservatively retain every repository PR: absence of an issue link is not
// proof of irrelevance. An operator can dismiss unrelated work with evidence.
export function cancellationCollector(db:Database,github:GitHub,maxChars:number):CollectEvidence{return async(b,r)=>{
 const bundle:CancellationBundle={complete:true,criteria:b.fundedTerms?.criteria??'',claims:[]};
 const add=(key:string,actorIds:string[],snapshot:Record<string,unknown>)=>{const raw=JSON.stringify(snapshot);if(raw.length>maxChars){bundle.complete=false;snapshot={truncated:true,preview:raw.slice(0,maxChars)};}bundle.claims.push({key:key+':'+sha256(JSON.stringify(snapshot)),actorIds,snapshot});};
 try{
  const {repo}=await currentAccess(github,b.installationId,b.repoId);
  const list=await github.pullRequests(b.installationId,repo);bundle.complete&&=list.complete;
  for(const listed of list.pulls){
   const pr=await github.pullRequest(b.installationId,repo,listed.number),files=await github.pullRequestFiles(b.installationId,repo,pr.number),authors=await github.pullRequestCommits(b.installationId,repo,pr.number);
   bundle.complete&&=files.complete&&authors.complete&&files.files.every(f=>f.patch!==null);
   const after=await github.pullRequest(b.installationId,repo,pr.number);if(JSON.stringify(after)!==JSON.stringify(pr))bundle.complete=false;
   add('pr:'+pr.id,[pr.user.id,...authors.authors.map(a=>a.ghId)],{pr,files:files.files});
  }
  const afterList=await github.pullRequests(b.installationId,repo);if(!afterList.complete||JSON.stringify(afterList.pulls)!==JSON.stringify(list.pulls))bundle.complete=false;
  for(const c of await github.comments(b.installationId,repo,b.issueNumber))if(c.user.type!=='Bot')add('comment:'+c.id,[c.user.id],{commentId:c.id,body:c.body});
  for(const link of r.links){if(!github.cancellationReference){bundle.complete=false;continue;}add('reference:'+link,[],await github.cancellationReference(b.installationId,repo,link));}
 }catch{bundle.complete=false;}
 const saved=await db.orm.select().from(submissions).where(eq(submissions.bountyId,b.id));
 for(const sub of saved){const patches=await db.orm.select().from(submissionEvidence).where(eq(submissionEvidence.submissionId,sub.id));if(!patches.length)bundle.complete=false;for(const patch of patches){if(patch.inputTruncated)bundle.complete=false;add('saved:'+patch.id,[sub.authorGhId,...patch.eligibleAuthors.map(a=>a.ghId)],{submission:sub.id,headSha:patch.headSha,baseSha:patch.baseSha,diff:patch.diffText,body:patch.body,title:patch.title,ci:patch.ci});}}
 bundle.claims.sort((a,b)=>a.key.localeCompare(b.key));return bundle;
};}
