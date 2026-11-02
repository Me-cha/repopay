import { createServer } from 'node:http';
import { parseAuthEnv,type FundingEnv } from '../../src/env.js';
import { createAuth, type OAuthProvider } from '../../src/github/oauth.js';
import { buildApp } from '../../src/http/routes.js';
import { installations, bounties,copilotSponsors } from '../../src/db/schema.js';
import { syntheticEnv } from './env.js';
import { githubFixture } from './github.js';
import { encrypt } from '../../src/util/crypto.js';
export async function authFixture(clock={now:()=>new Date()},fundingEnv?:FundingEnv) {
 const f=await githubFixture();const env=fundingEnv??parseAuthEnv({...syntheticEnv(),PUBLIC_URL:'https://repopay.test'});
 const permissions={read:true,write:true,fail:false,repoId:'2'};
 const provider:OAuthProvider={exchange:()=>Promise.resolve({accessToken:'user-access',refreshToken:'user-refresh',expiresIn:3600,refreshExpiresIn:7200}),refresh:()=>Promise.reject(new Error('unexpected refresh')),identity:()=>Promise.resolve({id:'4',login:'maintainer'}),repository:(_token,repoId)=>{if(permissions.fail)return Promise.reject(new Error('provider outage'));return Promise.resolve({id:permissions.repoId===repoId?repoId:permissions.repoId,read:permissions.read,write:permissions.write,admin:true,ownerId:'4',ownerType:'User'});}};
 const auth=createAuth(f.database,env,provider,clock);const loginUrl=new URL(await auth.beginLogin('/','binding'));const login=await auth.completeLogin('code',required(loginUrl.searchParams.get('state')),'binding');
 await f.database.orm.insert(installations).values({id:'1',accountId:'10',accountLogin:'owner'});
 const [bounty]=await f.database.orm.insert(bounties).values({installationId:'1',repoId:'2',repoFullName:'owner/repo',issueNumber:12,amountCents:5000,createdByGhId:'4',createdVia:'command'}).returning();if(!bounty)throw new Error('missing draft');
 if(fundingEnv)await f.database.orm.insert(copilotSponsors).values({repoId:bounty.repoId,installationId:bounty.installationId,sponsorGhId:'4',sponsorLogin:'maintainer',accessTokenEnc:encrypt('ghu_sponsor-access',env.TOKEN_ENC_KEY,bounty.repoId+':copilot-access'),refreshTokenEnc:encrypt('ghr_sponsor-refresh',env.TOKEN_ENC_KEY,bounty.repoId+':copilot-refresh'),accessExpiresAt:new Date(Date.now()+3600000),refreshExpiresAt:new Date(Date.now()+7200000),modelId:fundingEnv.COPILOT_MODEL,modelVerifiedAt:new Date()});
 const server=createServer(buildApp({database:f.database,version:'test',authentication:{database:f.database,env,auth,github:f.api},...(fundingEnv?{funding:{env:fundingEnv,listCopilotModels:()=>Promise.resolve([{model:fundingEnv.COPILOT_MODEL,listed:true}])}}:{})}));
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw new Error('address');
 const request=(path:string,options:RequestInit={})=>fetch(`http://127.0.0.1:${String(address.port)}`+path,{...options,redirect:'manual',headers:mergeHeaders(login.cookie,options.headers)});
 return {...f,env,auth,provider,permissions,login,bounty,request,async close(){await new Promise<void>((resolve,reject)=>server.close(e=>{if(e)reject(e);else resolve();}));await f.close();}};
}
export function csrfFrom(html:string) {const value=/name="csrf" value="([A-Za-z0-9_-]+)"/.exec(html)?.[1];if(!value)throw new Error('missing csrf');return value;}
export const form=(csrf:string,extra:Record<string,string>={})=>({method:'POST',headers:{Origin:'https://repopay.test','Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf,...extra}).toString()});
export async function prepare(f:Awaited<ReturnType<typeof authFixture>>) {
 const path=`/bounties/${f.bounty.id}/cancel`;const page=await f.request(path);const response=await f.request(path,form(csrfFrom(await page.text())));expectStatus(response.status,303);const target=response.headers.get('location');if(!target)throw new Error('missing location');return target;
}
function expectStatus(actual:number,expected:number){if(actual!==expected)throw new Error(`Expected HTTP ${String(expected)}, received ${String(actual)}`);}

export function required<T>(value:T|null|undefined):T {if(value===null||value===undefined)throw new Error('Missing test fixture value');return value;}
function mergeHeaders(sessionCookie:string,headers:HeadersInit|undefined) {const result=new Headers(headers);if(!result.has('Cookie'))result.set('Cookie','repopay_session='+sessionCookie);return result;}
