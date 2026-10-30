import { expect,it } from 'vitest';
import { authFixture,csrfFrom,form } from '../helpers/auth.js';
import { fundingEnv } from '../helpers/funding.js';
import { copilotSponsorStates } from '../../src/db/schema.js';

it('sponsor connect hands the browser a GitHub authorize URL it can navigate to, not a cross-origin fetch redirect',async()=>{
 const f=await authFixture(undefined,fundingEnv());try{
  const path=`/bounties/${f.bounty.id}/copilot-sponsor`;
  const csrf=csrfFrom(await(await f.request(path)).text());
  const response=await f.request(path+'/connect',form(csrf));
  // actions.js submits with fetch; a 303 to github.com fails CORS and strands the owner.
  expect(response.status).toBe(200);
  const {redirect}=await response.json() as {redirect:string};
  const target=new URL(redirect);
  expect(target.origin+target.pathname).toBe('https://github.com/login/oauth/authorize');
  expect(target.searchParams.get('code_challenge_method')).toBe('S256');
  expect(response.headers.get('set-cookie')).toContain('gitpay_sponsor_oauth=');
  expect(await f.database.orm.select().from(copilotSponsorStates)).toHaveLength(1);
  const script=await(await f.request('/assets/actions.js')).text();
  expect(script).toContain('https://github.com/login/oauth/authorize');
 }finally{await f.close();}
});

it('sponsor connect still requires CSRF and Origin',async()=>{
 const f=await authFixture(undefined,fundingEnv());try{
  const response=await f.request(`/bounties/${f.bounty.id}/copilot-sponsor/connect`,form('wrong'));
  expect(response.status).toBe(403);
  expect(await f.database.orm.select().from(copilotSponsorStates)).toHaveLength(0);
 }finally{await f.close();}
});
it('a refresh started before reconnection cannot overwrite the new sponsor grant',async()=>{
 const f=await authFixture();try{
  const sponsor={repoId:'2',installationId:'1',user:{id:'4',login:'maintainer'},modelId:'auto'};
  await f.auth.saveCopilotSponsor({...sponsor,token:{accessToken:'old',refreshToken:'old-refresh',expiresIn:0,refreshExpiresIn:3600}});
  f.provider.refresh=async()=>{
   await f.auth.saveCopilotSponsor({...sponsor,token:{accessToken:'new-consent',refreshToken:'new-refresh',expiresIn:3600,refreshExpiresIn:7200}});
   return {accessToken:'stale-refresh-result',refreshToken:'stale-refresh',expiresIn:3600,refreshExpiresIn:7200};
  };
  await expect(f.auth.getCopilotSponsor('2')).rejects.toThrow();
  expect((await f.auth.getCopilotSponsor('2')).accessToken).toBe('new-consent');
 }finally{await f.close();}
});
it('signed authorization revocation invalidates grants and sessions; replay cannot revoke renewed consent',async()=>{
 const f=await authFixture(undefined,fundingEnv());try{
  const {createHmac}=await import('node:crypto');const {ingestGitHub}=await import('../../src/github/handlers.js');
  const {sessions}=await import('../../src/db/schema.js');
  const raw=Buffer.from(JSON.stringify({action:'revoked',sender:{id:4}})),secret='x'.repeat(32);
  const headers={event:'github_app_authorization',deliveryId:'revoked-once',signature:'sha256='+createHmac('sha256',secret).update(raw).digest('hex')};
  await expect(ingestGitHub(f.database,secret,3,raw,{...headers,signature:'sha256'+'0'.repeat(64)})).rejects.toThrow();
  expect(await f.auth.getCopilotSponsor('2')).toBeDefined();
  await ingestGitHub(f.database,secret,3,raw,headers);
  await expect(f.auth.getCopilotSponsor('2')).rejects.toThrow();
  expect(await f.database.orm.select().from(sessions)).toHaveLength(0);
  await f.auth.saveCopilotSponsor({repoId:'2',installationId:'1',user:{id:'4',login:'maintainer'},modelId:'auto',token:{accessToken:'ghu_new',refreshToken:'refresh',expiresIn:3600,refreshExpiresIn:7200}});
  await ingestGitHub(f.database,secret,3,raw,headers);
  expect((await f.auth.getCopilotSponsor('2')).accessToken).toBe('ghu_new');
 }finally{await f.close();}
});
