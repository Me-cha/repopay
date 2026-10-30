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
