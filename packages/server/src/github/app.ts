import { sign } from 'node:crypto';
import { z } from 'zod';
import { requestJson } from '../preflight/http.js';
import type { GitHubRuntimeEnv } from '../env.js';
import { apiId } from './handlers.js';
const account=z.object({id:apiId,login:z.string()});
const installationSchema=z.object({id:apiId,app_id:apiId,account,suspended_at:z.string().nullable()});
const repoSchema=z.object({id:apiId,full_name:z.string().regex(/^[\w.-]+\/[\w.-]+$/),archived:z.boolean(),disabled:z.boolean().optional()});
const issueSchema=z.object({number:z.number().int().positive(),pull_request:z.unknown().optional()});
const commentSchema=z.object({id:apiId,body:z.string().nullable(),user:z.object({id:apiId,type:z.string()}),performed_via_github_app:z.object({id:apiId}).nullable().optional()});
export type Installation=z.infer<typeof installationSchema>;
export type Repository=z.infer<typeof repoSchema>;
export type Comment=z.infer<typeof commentSchema>;
export class GitHubError extends Error { constructor(readonly status: number) {super(`GitHub request failed (${String(status)}); check access and retry`);} }
export interface GitHub {
 installation:(id:string)=>Promise<Installation|null>;
 repository:(installationId:string,repoId:string)=>Promise<Repository>;
 issue:(installationId:string,repo:Repository,number:number)=>Promise<void>;
 permission:(installationId:string,repo:Repository,actorId:string)=>Promise<'write'|'read'|'none'>;
 comments:(installationId:string,repo:Repository,number:number)=>Promise<Comment[]>;
 createComment:(installationId:string,repo:Repository,number:number,body:string)=>Promise<Comment>;
 updateComment:(installationId:string,repo:Repository,id:string,body:string)=>Promise<void>;
 badge:(installationId:string,repo:Repository,number:number)=>Promise<void>;
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
  async installation(id) {const res=await request(`/app/installations/${id}`,jwt());if(res.status===404){tokens.delete(id);return null;}if(res.status!==200)throw new GitHubError(res.status);const v=installationSchema.parse(res.body);if(v.id!==id||v.app_id!==env.GH_APP_ID)throw new GitHubError(403);if(v.suspended_at)tokens.delete(id);return v;},
  async repository(inst,id) {const repo=repoSchema.parse(await call(inst,`/repositories/${id}`));if(repo.id!==id||repo.archived||repo.disabled)throw new GitHubError(403);const binding=await request(`/repos/${repo.full_name}/installation`,jwt());if(binding.status!==200||z.object({id:apiId}).parse(binding.body).id!==inst)throw new GitHubError(403);return repo;},
  async issue(inst,repo,number) {const issue=issueSchema.parse(await call(inst,`${prefix(repo)}/issues/${String(number)}`));if(issue.number!==number||issue.pull_request)throw new GitHubError(400);},
  async permission(inst,repo,actorId) {
   const user=account.parse(await call(inst,`/user/${actorId}`));if(user.id!==actorId)throw new GitHubError(403);
   try {const data=z.object({permission:z.string(),user:account}).parse(await call(inst,`${prefix(repo)}/collaborators/${encodeURIComponent(user.login)}/permission`));if(data.user.id!==actorId)throw new GitHubError(403);return ['admin','write','maintain'].includes(data.permission)?'write':data.permission==='none'?'none':'read';}catch(error){if(error instanceof GitHubError&&error.status===404)return 'none';throw error;}
  },
  async comments(inst,repo,number) {const result:Comment[]=[];for(let page=1;page<=env.RECONCILIATION_PAGE_LIMIT;page++){const rows=z.array(commentSchema).parse(await call(inst,`${prefix(repo)}/issues/${String(number)}/comments?per_page=100&page=${String(page)}`));result.push(...rows);if(rows.length<100)return result;}throw new Error('Comment pagination incomplete; no write attempted');},
  async createComment(inst,repo,number,body){return commentSchema.parse(await call(inst,`${prefix(repo)}/issues/${String(number)}/comments`,'POST',{body}));},
  async updateComment(inst,repo,id,body){await call(inst,`${prefix(repo)}/issues/comments/${id}`,'PATCH',{body});},
  async badge(inst,repo,number){try{await call(inst,`${prefix(repo)}/labels/bounty-open`);}catch(error){if(!(error instanceof GitHubError&&error.status===404))throw error;try{await call(inst,`${prefix(repo)}/labels`,'POST',{name:'bounty-open',color:'6f42c1',description:'Unfunded GitPay bounty draft'});}catch(error){if(!(error instanceof GitHubError&&error.status===422))throw error;}}await call(inst,`${prefix(repo)}/issues/${String(number)}/labels`,'POST',{labels:['bounty-open']});},
 };
}
