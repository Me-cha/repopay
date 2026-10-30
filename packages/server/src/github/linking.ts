import { and,eq,inArray } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { bounties,submissions } from '../db/schema.js';
import type { GitHub,Repository } from './app.js';
import { linkPr } from '../actions/link.js';

function issueReferences(text:string,fullName:string):number[] {
 const escaped=fullName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const pattern=new RegExp(`\\b(?:close[sd]?|fix(?:es|ed)?|resolve[sd]?)\\s+(?:${escaped}#)?#?(\\d+)\\b`,'gi');
 return [...new Set([...text.matchAll(pattern)].map(match=>Number(match[1])).filter(value=>Number.isSafeInteger(value)&&value>0))];
}
export async function refreshPrLinks(db:Database,github:GitHub,installationId:string,repo:Repository,prNumber:number,forcedIssue?:number) {
 const pr=await github.pullRequest(installationId,repo,prNumber);
 const issues=forcedIssue?[forcedIssue]:issueReferences(`${pr.title}\n${pr.body??''}`,repo.full_name);
 const existing=await db.orm.select({bountyId:submissions.bountyId}).from(submissions).where(and(eq(submissions.repoId,repo.id),eq(submissions.prId,pr.id)));
 const linked=await Promise.all(issues.map(async issueNumber=>{
  const [bounty]=await db.orm.select({id:bounties.id}).from(bounties).where(and(eq(bounties.repoId,repo.id),eq(bounties.issueNumber,issueNumber),inArray(bounties.status,['OPEN','FUNDED'])));
  return bounty?.id;
 }));
 const resolved=new Set([...existing.map(row=>row.bountyId),...linked.filter((id):id is string=>!!id)]);
 const results=[];
 for(const bountyId of resolved) {
  if(!bountyId)continue;const [bounty]=await db.orm.select().from(bounties).where(eq(bounties.id,bountyId));if(!bounty||!['OPEN','FUNDED'].includes(bounty.status)||bounty.fundingHold)continue;
  results.push(await linkPr(db,bounty,pr));
 }
 return {pullRequest:pr,results};
}
