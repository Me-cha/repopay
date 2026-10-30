import type { IssueTerms } from '../domain/funded-terms.js';
import { sign } from 'node:crypto';
import { z } from 'zod';
import { requestJson } from '../preflight/http.js';
import type { GitHubRuntimeEnv } from '../env.js';
import { apiId } from './handlers.js';
const account=z.object({id:apiId,login:z.string()});
const installationSchema=z.object({id:apiId,app_id:apiId,account,suspended_at:z.string().nullable()});
const repoSchema=z.object({id:apiId,full_name:z.string().regex(/^[\w.-]+\/[\w.-]+$/),archived:z.boolean(),private:z.boolean().optional(),disabled:z.boolean().optional()});
const issueSchema=z.object({number:z.number().int().positive(),pull_request:z.unknown().optional()});
const commentSchema=z.object({id:apiId,body:z.string().nullable(),user:z.object({id:apiId,type:z.string()}),performed_via_github_app:z.object({id:apiId}).nullable().optional()});
const pullRequestSchema=z.object({id:apiId,number:z.number().int().positive(),state:z.enum(['open','closed']),draft:z.boolean().optional(),title:z.string().max(1000),body:z.string().nullable(),merged_at:z.string().nullable(),merge_commit_sha:z.string().regex(/^[a-f0-9]{40,64}$/i).nullable().optional(),closed_at:z.string().nullable(),user:z.object({id:apiId,login:z.string().min(1).max(100),type:z.string()}),head:z.object({sha:z.string().regex(/^[a-f0-9]{40,64}$/i)}),base:z.object({sha:z.string().regex(/^[a-f0-9]{40,64}$/i),repo:z.object({id:apiId}).nullable()})});
const pullFileSchema=z.object({filename:z.string().max(1024),status:z.string(),additions:z.number().int().nonnegative(),deletions:z.number().int().nonnegative(),patch:z.string().nullable()});
const commitSchema=z.object({sha:z.string().regex(/^[a-f0-9]{40,64}$/i),author:z.object({id:apiId,login:z.string().min(1).max(100),type:z.string()}).nullable()});
const checkRunSchema=z.object({id:apiId,external_id:z.string().nullable().optional(),name:z.string().max(200),head_sha:z.string().regex(/^[a-f0-9]{40,64}$/i),status:z.enum(['queued','in_progress','completed']),conclusion:z.string().nullable(),app:z.object({id:apiId,name:z.string().nullable().optional()}).nullable()});
export type PullRequest=z.infer<typeof pullRequestSchema>;
export type PullRequestFile=z.infer<typeof pullFileSchema>;
export type CheckRun=z.infer<typeof checkRunSchema>;
export interface CheckSnapshot {runs:CheckRun[];complete:boolean}
export type Installation=z.infer<typeof installationSchema>;
export type Repository=z.infer<typeof repoSchema>;
export type Comment=z.infer<typeof commentSchema>;
export class GitHubError extends Error { constructor(readonly status: number) {super(`GitHub request failed (${String(status)}); check access and retry`);} }
export interface GitHub {
 cancellationReference?:(installationId:string,repo:Repository,url:string)=>Promise<Record<string,unknown>>;
 installation:(id:string)=>Promise<Installation|null>;
 repository:(installationId:string,repoId:string)=>Promise<Repository>;
 issue:(installationId:string,repo:Repository,number:number)=>Promise<void>;
 issueTerms:(installationId:string,repo:Repository,number:number)=>Promise<IssueTerms>;
 permission:(installationId:string,repo:Repository,actorId:string)=>Promise<'write'|'read'|'none'>;
 comments:(installationId:string,repo:Repository,number:number)=>Promise<Comment[]>;
 createComment:(installationId:string,repo:Repository,number:number,body:string)=>Promise<Comment>;
 updateComment:(installationId:string,repo:Repository,id:string,body:string)=>Promise<void>;
 badge:(installationId:string,repo:Repository,number:number,status?:string)=>Promise<void>;
 closingIssues:(installationId:string,repo:Repository,number:number)=>Promise<{prId:string;issueNumbers:number[];complete:boolean}>;
 pullRequestPage:(installationId:string,repo:Repository,page:number)=>Promise<{pulls:PullRequest[];hasMore:boolean}>;
 pullRequests:(installationId:string,repo:Repository)=>Promise<{pulls:PullRequest[];complete:boolean}>;
 pullRequest:(installationId:string,repo:Repository,number:number)=>Promise<PullRequest>;
 pullRequestFiles:(installationId:string,repo:Repository,number:number)=>Promise<{files:PullRequestFile[];complete:boolean}>;
 pullRequestCommits:(installationId:string,repo:Repository,number:number)=>Promise<{authors:{ghId:string;login:string;type:string}[];complete:boolean}>;
 checkRuns:(installationId:string,repo:Repository,sha:string)=>Promise<CheckSnapshot>;
 createCheckRun:(installationId:string,repo:Repository,input:{name:string;headSha:string;externalId:string;detailsUrl:string;status:'in_progress'|'completed';conclusion?:'success'|'neutral'|'failure';title:string;summary:string})=>Promise<string>;
 updateCheckRun:(installationId:string,repo:Repository,id:string,input:{detailsUrl:string;status:'in_progress'|'completed';conclusion?:'success'|'neutral'|'failure';title:string;summary:string})=>Promise<void>;
}
export function createGitHub(env: GitHubRuntimeEnv): GitHub {
 const tokens=new Map<string,{token:string;expires:number}>();
 function jwt():string {
  const now=Math.floor(Date.now()/1000);
  const data=Buffer.from(JSON.stringify({alg:'RS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({iat:now-60,exp:now+540,iss:env.GH_CLIENT_ID})).toString('base64url');
  return data+'.'+sign('RSA-SHA256',Buffer.from(data),env.GH_PRIVATE_KEY.replaceAll('\\n','\n')).toString('base64url');
 }
 async function request(path:string, token:string, method='GET', body?:unknown) {
  return requestJson(env,'https://api.github.com'+path,{method,headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','User-Agent':'GitPay','X-GitHub-Api-Version':'2026-03-10','Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 }
 async function token(id:string) {
  const cached=tokens.get(id);if(cached && cached.expires>Date.now()+60000)return cached.token;
  const res=await request(`/app/installations/${id}/access_tokens`,jwt(),'POST');if(res.status!==201)throw new GitHubError(res.status);
  const data=z.object({token:z.string().min(1),expires_at:z.iso.datetime()}).parse(res.body);
  tokens.set(id,{token:data.token,expires:Date.parse(data.expires_at)});return data.token;
 }
 async function call(inst:string,path:string,method='GET',body?:unknown) {
  const res=await request(path,await token(inst),method,body);
  if(res.status===401)tokens.delete(inst);
  if(res.status<200||res.status>=300)throw new GitHubError(res.status);return res.body;
 }
 const prefix=(repo:Repository)=>'/repos/'+repo.full_name;
 return {
  async cancellationReference(inst,repo,url){
   const u=new URL(url),suffix=u.pathname.slice(repo.full_name.length+1);
   if(u.origin!=='https://github.com'||!u.pathname.startsWith('/'+repo.full_name+'/')||u.search||u.hash)throw new Error('Invalid evidence reference');
   if(/^\/commit\/[a-f0-9]{40}$/i.test(suffix)){
    const data=z.object({sha:z.string(),commit:z.object({message:z.string(),author:z.object({date:z.string()}).nullable()}),files:z.array(pullFileSchema).max(300)}).parse(await call(inst,prefix(repo)+'/commits/'+(suffix.split('/')[2]??'')));
    if(data.files.length>=300||data.files.some(f=>f.patch===null))throw new Error('Incomplete claimed-fix evidence');return data;
   }
   if(/^\/(issues|pull)\/[1-9]\d*$/.test(suffix)){const data=z.object({title:z.string(),body:z.string().nullable(),created_at:z.string(),updated_at:z.string(),user:account}).parse(await call(inst,prefix(repo)+'/issues/'+(suffix.split('/')[2]??'')));return data;}
   throw new Error('Invalid evidence reference');
  },
  async installation(id) {const res=await request(`/app/installations/${id}`,jwt());if(res.status===404){tokens.delete(id);return null;}if(res.status!==200)throw new GitHubError(res.status);const v=installationSchema.parse(res.body);if(v.id!==id||v.app_id!==env.GH_APP_ID)throw new GitHubError(403);if(v.suspended_at)tokens.delete(id);return v;},
  async repository(inst,id) {const repo=repoSchema.parse(await call(inst,`/repositories/${id}`));if(repo.id!==id||repo.archived||repo.disabled)throw new GitHubError(403);const binding=await request(`/repos/${repo.full_name}/installation`,jwt());if(binding.status!==200||z.object({id:apiId}).parse(binding.body).id!==inst)throw new GitHubError(403);return repo;},
  async issue(inst,repo,number) {const issue=issueSchema.parse(await call(inst,`${prefix(repo)}/issues/${String(number)}`));if(issue.number!==number||issue.pull_request)throw new GitHubError(400);},
  async issueTerms(inst,repo,number) {const value=issueSchema.extend({title:z.string().max(1000),body:z.string().nullable(),updated_at:z.string()}).parse(await call(inst,`${prefix(repo)}/issues/${String(number)}`));if(value.number!==number||value.pull_request)throw new GitHubError(400);return {title:value.title,body:value.body??'',updatedAt:value.updated_at};},
  async permission(inst,repo,actorId) {
   const user=account.parse(await call(inst,`/user/${actorId}`));if(user.id!==actorId)throw new GitHubError(403);
   try {const data=z.object({permission:z.string(),user:account}).parse(await call(inst,`${prefix(repo)}/collaborators/${encodeURIComponent(user.login)}/permission`));if(data.user.id!==actorId)throw new GitHubError(403);return ['admin','write','maintain'].includes(data.permission)?'write':data.permission==='none'?'none':'read';}catch(error){if(error instanceof GitHubError&&error.status===404)return repo.private===false?'read':'none';throw error;}
  },
  async comments(inst,repo,number) {const result:Comment[]=[];for(let page=1;page<=env.RECONCILIATION_PAGE_LIMIT;page++){const rows=z.array(commentSchema).parse(await call(inst,`${prefix(repo)}/issues/${String(number)}/comments?per_page=100&page=${String(page)}`));result.push(...rows);if(rows.length<100)return result;}throw new Error('Comment pagination incomplete; no write attempted');},
  async createComment(inst,repo,number,body){return commentSchema.parse(await call(inst,`${prefix(repo)}/issues/${String(number)}/comments`,'POST',{body}));},
  async updateComment(inst,repo,id,body){await call(inst,`${prefix(repo)}/issues/comments/${id}`,'PATCH',{body});},
  async badge(inst,repo,number,status='OPEN'){
   const label='bounty-open',description='Open GitPay bounty; see the bot comment for funding status';
   const acceptingSubmissions=['OPEN','CAPTURING','FUNDED','NEEDS_REVIEW'].includes(status);
   if(!acceptingSubmissions){
    try{await call(inst,`${prefix(repo)}/issues/${String(number)}/labels/${label}`,'DELETE');}
    catch(error){if(!(error instanceof GitHubError&&error.status===404))throw error;}
    return;
   }
   try{
    const current=z.object({description:z.string().nullable().optional()}).parse(await call(inst,`${prefix(repo)}/labels/${label}`));
    if(current.description!==description)await call(inst,`${prefix(repo)}/labels/${label}`,'PATCH',{description});
   }catch(error){
    if(!(error instanceof GitHubError&&error.status===404))throw error;
    try{await call(inst,`${prefix(repo)}/labels`,'POST',{name:label,color:'6f42c1',description});}
    catch(error){if(!(error instanceof GitHubError&&error.status===422))throw error;}
   }
   await call(inst,`${prefix(repo)}/issues/${String(number)}/labels`,'POST',{labels:[label]});
  },
  async closingIssues(inst,repo,number){
   const [owner,name]=repo.full_name.split('/');let after:string|null=null,prId='';const issueNumbers:number[]=[];
   const query='query($owner:String!,$name:String!,$number:Int!,$after:String){repository(owner:$owner,name:$name){nameWithOwner pullRequest(number:$number){fullDatabaseId closingIssuesReferences(first:100,after:$after){nodes{number repository{nameWithOwner}} pageInfo{hasNextPage endCursor}}}}}';
   const shape=z.object({errors:z.array(z.unknown()).optional(),data:z.object({repository:z.object({nameWithOwner:z.string(),pullRequest:z.object({fullDatabaseId:apiId,closingIssuesReferences:z.object({nodes:z.array(z.object({number:z.number().int().positive(),repository:z.object({nameWithOwner:z.string()})})),pageInfo:z.object({hasNextPage:z.boolean(),endCursor:z.string().max(1000).nullable()})})})})}).optional()});
   for(let page=0;page<env.RECONCILIATION_PAGE_LIMIT;page++){
    const response=shape.parse(await call(inst,'/graphql','POST',{query,variables:{owner,name,number,after}}));
    const data=response.data?.repository;if(response.errors?.length||!data||data.nameWithOwner!==repo.full_name)throw new Error('Closing-reference evidence unavailable');
    const pr=data.pullRequest;if(prId&&prId!==pr.fullDatabaseId)throw new Error('Pull request identity changed');prId=pr.fullDatabaseId;
    for(const issue of pr.closingIssuesReferences.nodes)if(issue.repository.nameWithOwner===repo.full_name)issueNumbers.push(issue.number);
    const info=pr.closingIssuesReferences.pageInfo;if(!info.hasNextPage)return {prId,issueNumbers:[...new Set(issueNumbers)],complete:true};
    if(!info.endCursor||info.endCursor===after)throw new Error('Closing-reference pagination did not advance');after=info.endCursor;
   }
   return {prId,issueNumbers:[...new Set(issueNumbers)],complete:false};
  },
  async pullRequestPage(inst,repo,page){if(!Number.isSafeInteger(page)||page<1)throw new Error('Invalid PR page');const pulls=z.array(pullRequestSchema).parse(await call(inst,`${prefix(repo)}/pulls?state=all&sort=created&direction=asc&per_page=100&page=${String(page)}`));return {pulls,hasMore:pulls.length===100};},
  async pullRequests(inst,repo){const pulls:PullRequest[]=[];for(let page=1;page<=env.RECONCILIATION_PAGE_LIMIT;page++){const rows=z.array(pullRequestSchema).parse(await call(inst,`${prefix(repo)}/pulls?state=all&sort=created&direction=asc&per_page=100&page=${String(page)}`));pulls.push(...rows);if(rows.length<100)return {pulls,complete:true};}return {pulls,complete:false};},
  async pullRequest(inst,repo,number){
   const pr=pullRequestSchema.parse(await call(inst,`${prefix(repo)}/pulls/${String(number)}`));if(pr.number!==number||pr.base.repo?.id!==repo.id)throw new GitHubError(403);
   if(pr.merged_at&&!pr.merge_commit_sha){
    const [owner,name]=repo.full_name.split('/');
    const query='query($owner:String!,$name:String!,$number:Int!){repository(owner:$owner,name:$name){nameWithOwner pullRequest(number:$number){fullDatabaseId headRefOid mergedAt mergeCommit{oid}}}}';
    const shape=z.object({errors:z.array(z.unknown()).optional(),data:z.object({repository:z.object({nameWithOwner:z.string(),pullRequest:z.object({fullDatabaseId:apiId,headRefOid:z.string(),mergedAt:z.string(),mergeCommit:z.object({oid:z.string().regex(/^[a-f0-9]{40,64}$/i)})})})}).optional()});
    const response=shape.parse(await call(inst,'/graphql','POST',{query,variables:{owner,name,number}})),data=response.data?.repository,merged=data?.pullRequest;
    if(response.errors?.length||data?.nameWithOwner!==repo.full_name||!merged||merged.fullDatabaseId!==pr.id||merged.headRefOid!==pr.head.sha||merged.mergedAt!==pr.merged_at)throw new Error('Merged revision evidence unavailable');
    pr.merge_commit_sha=merged.mergeCommit.oid;
   }
   return pr;
  },
  async pullRequestFiles(inst,repo,number){const files:PullRequestFile[]=[];for(let page=1;page<=env.RECONCILIATION_PAGE_LIMIT;page++){const rows=z.array(pullFileSchema).parse(await call(inst,`${prefix(repo)}/pulls/${String(number)}/files?per_page=100&page=${String(page)}`));files.push(...rows);if(rows.length<100)return {files,complete:true};}return {files,complete:false};},
  async pullRequestCommits(inst,repo,number){const authors:{ghId:string;login:string;type:string}[]=[];for(let page=1;page<=env.RECONCILIATION_PAGE_LIMIT;page++){const rows=z.array(commitSchema).parse(await call(inst,`${prefix(repo)}/pulls/${String(number)}/commits?per_page=100&page=${String(page)}`));for(const row of rows)if(row.author)authors.push({ghId:row.author.id,login:row.author.login,type:row.author.type});if(rows.length<100)return {authors,complete:true};}return {authors,complete:false};},
  async checkRuns(inst,repo,sha){const runs:CheckRun[]=[];for(let page=1;page<=env.RECONCILIATION_PAGE_LIMIT;page++){const response=z.object({check_runs:z.array(checkRunSchema)}).parse(await call(inst,`${prefix(repo)}/commits/${encodeURIComponent(sha)}/check-runs?filter=all&per_page=100&page=${String(page)}`));runs.push(...response.check_runs);if(response.check_runs.length<100)return {runs,complete:true};}return {runs,complete:false};},
  async createCheckRun(inst,repo,input){const value=z.object({id:apiId}).parse(await call(inst,`${prefix(repo)}/check-runs`,'POST',{name:input.name,head_sha:input.headSha,external_id:input.externalId,details_url:input.detailsUrl,status:input.status,...(input.conclusion?{conclusion:input.conclusion}:{}),output:{title:input.title,summary:input.summary}}));return value.id;},
  async updateCheckRun(inst,repo,id,input){await call(inst,`${prefix(repo)}/check-runs/${id}`,'PATCH',{details_url:input.detailsUrl,status:input.status,...(input.conclusion?{conclusion:input.conclusion}:{}),output:{title:input.title,summary:input.summary}});},
 };
}
