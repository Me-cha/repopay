import { createHash, generateKeyPairSync } from 'node:crypto';
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

it('recovers missing REST merge SHA from identity-bound GraphQL evidence',async()=>{
 const app=createGitHub(env);token();
 const pr={id:42,number:3,state:'closed',title:'Fix',body:'Fixes #1',merged_at:'2026-10-30T12:00:16Z',closed_at:'2026-10-30T12:00:16Z',user:{id:7,login:'contributor',type:'User'},head:{sha:'a'.repeat(40)},base:{sha:'b'.repeat(40),repo:{id:2}}};
 const graph=(id:string)=>({data:{repository:{nameWithOwner:repo.full_name,pullRequest:{fullDatabaseId:id,headRefOid:pr.head.sha,mergedAt:pr.merged_at,mergeCommit:{oid:'c'.repeat(40)}}}}});
 nock('https://api.github.com').get('/repos/owner/repo/pulls/3').reply(200,pr).post('/graphql').reply(200,graph('42'));
 expect((await app.pullRequest('1',repo,3)).merge_commit_sha).toBe('c'.repeat(40));
 nock('https://api.github.com').get('/repos/owner/repo/pulls/3').reply(200,pr).post('/graphql').reply(200,graph('99'));
 await expect(app.pullRequest('1',repo,3)).rejects.toThrow();
});

it('reads bounded full-file context with exact commit and blob identities',async()=>{
 const app=createGitHub(env),text="test('unchanged assertion',()=>{});\n",bytes=Buffer.from(text),sha=createHash('sha1').update(`blob ${String(bytes.length)}\0`).update(bytes).digest('hex');token();
 nock('https://api.github.com').get('/repos/owner/repo/contents/test/a%20b.test.js').query({ref:'a'.repeat(40)}).reply(200,{type:'file',path:'test/a b.test.js',sha,size:bytes.length,encoding:'base64',content:bytes.toString('base64')});
 expect(await app.fileAtRevision('1',repo,'test/a b.test.js','a'.repeat(40),sha)).toBe(text);
});
it.each(['path','sha','size','encoding','binary','symlink','directory','hash'])('rejects invalid full-file context: %s',async(mode)=>{
 const app=createGitHub(env),bytes=Buffer.from(mode==='binary'?'\0':'test();'),sha=createHash('sha1').update(`blob ${String(bytes.length)}\0`).update(bytes).digest('hex');token();
 const value={type:'file',path:'test/a.js',sha,size:bytes.length,encoding:'base64',content:bytes.toString('base64'),...(mode==='path'?{path:'other.js'}:{}),...(mode==='sha'?{sha:'b'.repeat(40)}:{}),...(mode==='size'?{size:16385}:{}),...(mode==='encoding'?{encoding:'none'}:{}),...(mode==='symlink'?{type:'symlink',target:'../secret'}:{}),...(mode==='directory'?{type:'dir'}:{}),...(mode==='hash'?{content:Buffer.from('fake();').toString('base64')}:{} )};
 nock('https://api.github.com').get('/repos/owner/repo/contents/test/a.js').query({ref:'a'.repeat(40)}).reply(200,value);
 await expect(app.fileAtRevision('1',repo,'test/a.js','a'.repeat(40),sha)).rejects.toThrow();
});
it('rejects traversal and mutable refs before provider access',async()=>{
 const app=createGitHub(env);
 for(const path of ['../secret','test/../secret','/test/a.js','test//a.js','test\\a.js'])await expect(app.fileAtRevision('1',repo,path,'a'.repeat(40),'b'.repeat(40))).rejects.toThrow();
 await expect(app.fileAtRevision('1',repo,'test/a.js','main','b'.repeat(40))).rejects.toThrow();
});


it('projects PAID as bounty-paid and removes bounty-open without replacing other labels',async()=>{
 const app=createGitHub(env);token();
 const api=nock('https://api.github.com')
 .delete('/repos/owner/repo/issues/4/labels/bounty-open').reply(200,[])
 .get('/repos/owner/repo/labels/bounty-paid').reply(404,{})
 .post('/repos/owner/repo/labels',{name:'bounty-paid',color:'0e8a16',description:'GitPay payout completed; see the bot comment for delivery status'}).reply(201,{})
 .post('/repos/owner/repo/issues/4/labels',{labels:['bounty-paid']}).reply(200,[]);
 await app.badge('1',repo,4,'PAID');expect(api.isDone()).toBe(true);
});
it.each(['AWAITING_CLAIM','PAYING','CANCELLED'])('removes misleading open and paid labels for %s',async(status)=>{
 const app=createGitHub(env);token();const api=nock('https://api.github.com')
 .delete('/repos/owner/repo/issues/4/labels/bounty-open').reply(404,{})
 .delete('/repos/owner/repo/issues/4/labels/bounty-paid').reply(200,[]);
 await app.badge('1',repo,4,status);expect(api.isDone()).toBe(true);
});

it('retains API-validated commit SHAs without commit emails or messages in attribution metadata',async()=>{
 const app=createGitHub(env);token();nock('https://api.github.com').get('/repos/owner/repo/pulls/12/commits?per_page=100&page=1').reply(200,[{sha:'a'.repeat(40),author:{id:8,login:'contributor',type:'User'},commit:{message:'untrusted content',author:{email:'private@example.test'}}},{sha:'b'.repeat(40),author:null}]);
 const evidence=await app.pullRequestCommits('1',repo,12);expect(evidence).toEqual({authors:[{ghId:'8',login:'contributor',type:'User',commitSha:'a'.repeat(40)}],complete:true});expect(JSON.stringify(evidence)).not.toContain('private@example.test');expect(JSON.stringify(evidence)).not.toContain('untrusted content');
});
