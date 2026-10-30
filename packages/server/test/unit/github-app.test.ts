import { generateKeyPairSync } from 'node:crypto';
import nock from 'nock';
import { expect, it } from 'vitest';
import { createGitHub } from '../../src/github/app.js';
import { testEnv } from '../helpers/github.js';
const privateKey=generateKeyPairSync('rsa',{modulusLength:2048}).privateKey.export({type:'pkcs8',format:'pem'}).toString();
const env={...testEnv,GH_APP_ID:'5',GH_PRIVATE_KEY:privateKey};
const repo={id:'2',full_name:'owner/repo',archived:false};
const token=()=>nock('https://api.github.com').post('/app/installations/1/access_tokens').reply(201,{token:'synthetic-installation-token',expires_at:new Date(Date.now()+3600000).toISOString()});
it('validates installation, stable repo/user identity and current write permission',async()=>{
 const app=createGitHub(env);
 nock('https://api.github.com').get('/app/installations/1').reply(200,{id:1,app_id:5,account:{id:10,login:'owner'},suspended_at:null});
 expect((await app.installation('1'))?.id).toBe('1');
 token();nock('https://api.github.com').get('/repositories/2').reply(200,{...repo,id:2}).get('/repos/owner/repo/installation').reply(200,{id:1});expect(await app.repository('1','2')).toEqual(repo);
 nock('https://api.github.com').get('/user/4').reply(200,{id:4,login:'renamed'}).get('/repos/owner/repo/collaborators/renamed/permission').reply(200,{permission:'write',user:{id:4,login:'renamed'}});
 expect(await app.permission('1',repo,'4')).toBe('write');
});
it('rejects unsafe provider IDs and cross-repository substitution',async()=>{
 const app=createGitHub(env);token();nock('https://api.github.com').get('/repositories/2').reply(200,{...repo,id:3});await expect(app.repository('1','2')).rejects.toThrow();
 nock('https://api.github.com').get('/repositories/9007199254740993').reply(200,{...repo,id:9007199254740992});await expect(app.repository('1','9007199254740993')).rejects.toThrow();
});
it('incomplete comment pagination refuses to treat missing marker as absent',async()=>{
 const app=createGitHub({...env,RECONCILIATION_PAGE_LIMIT:1});token();nock('https://api.github.com').get('/repos/owner/repo/issues/12/comments?per_page=100&page=1').reply(200,Array.from({length:100},(_,i)=>({id:i+1,body:'comment',user:{id:4,type:'User'}})));
 await expect(app.comments('1',repo,12)).rejects.toThrow('pagination');
});
it('scoped runtime does not depend on future payment settings; full validation remains strict',async()=>{
 const {parseGitHubRuntimeEnv,parseEnv}=await import('../../src/env.js');const {syntheticEnv}=await import('../helpers/env.js');const input={...syntheticEnv(),PP_WEBHOOK_ID:''};
 expect(parseGitHubRuntimeEnv(input).GH_APP_SLUG).toBe('gitpay-test');expect(()=>parseEnv(input)).toThrow('PP_WEBHOOK_ID');
});

it('a public repo outside this installation is not authorized by a readable metadata endpoint',async()=>{
 const app=createGitHub(env);token();nock('https://api.github.com').get('/repositories/2').reply(200,{...repo,id:2}).get('/repos/owner/repo/installation').reply(200,{id:99});
 await expect(app.repository('1','2')).rejects.toThrow();
});
it('paginates authoritative closing references and excludes issues in other repositories',async()=>{
 const app=createGitHub(env);token();
 const page=(hasNextPage:boolean,endCursor:string|null,n:number)=>({data:{repository:{nameWithOwner:'owner/repo',pullRequest:{fullDatabaseId:'9007199254740993',closingIssuesReferences:{nodes:[{number:n,repository:{nameWithOwner:'owner/repo'}},{number:999,repository:{nameWithOwner:'other/repo'}}],pageInfo:{hasNextPage,endCursor}}}}}});
 nock('https://api.github.com').post('/graphql',body=>(body as {variables:{after:unknown}}).variables.after===null).reply(200,page(true,'next',12));
 nock('https://api.github.com').post('/graphql',body=>(body as {variables:{after:unknown}}).variables.after==='next').reply(200,page(false,null,13));
 expect(await app.closingIssues('1',repo,42)).toEqual({prId:'9007199254740993',issueNumbers:[12,13],complete:true});
});
it('partial GraphQL data with provider errors is never a complete candidate scan',async()=>{
 const app=createGitHub(env);token();nock('https://api.github.com').post('/graphql').reply(200,{errors:[{message:'resource inaccessible'}]});
 await expect(app.closingIssues('1',repo,42)).rejects.toThrow();
});
