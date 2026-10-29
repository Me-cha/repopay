import { expect, it } from 'vitest';
import pg from 'pg';
import { eq } from 'drizzle-orm';
import { createTestDatabase } from '../helpers/database.js';
import { migrateDatabase } from '../../src/db/migrate.js';
import { syntheticEnv } from '../helpers/env.js';
import { parseAuthEnv } from '../../src/env.js';
import { createAuth, type OAuthProvider, type TokenSet } from '../../src/github/oauth.js';
import { sessions, oauthStates } from '../../src/db/schema.js';

const tokens = (): TokenSet => ({ accessToken:'access-private',refreshToken:'refresh-private',expiresIn:3600,refreshExpiresIn:7200 });
async function fixture() {
 const f=await createTestDatabase(); await migrateDatabase(f.database);
 let now=new Date('2026-10-28T00:00:00Z');
 const counts={refresh:0};
 const provider:OAuthProvider={exchange:()=>Promise.resolve(tokens()),refresh:()=>{counts.refresh++;return Promise.resolve({...tokens(),accessToken:'rotated-private'});},identity:()=>Promise.resolve({id:'4',login:'maintainer'}),repository:()=>Promise.resolve({id:'2',write:true,read:true})};
 const env=parseAuthEnv(syntheticEnv());const auth=createAuth(f.database,env,provider,{now:()=>now});
 const login=async()=>{const url=await auth.beginLogin('/bounties/1/cancel','browser-binding');const state=new URL(url).searchParams.get('state');if(!state)throw new Error('no state');return auth.completeLogin('code',state,'browser-binding');};
 return {...f,auth,provider,counts,login,advance:(ms:number)=>{now=new Date(now.getTime()+ms);}};
}
it('browser-bound single-use OAuth state, PKCE and encrypted tokens',async()=>{
 const f=await fixture();try{
 const url=new URL(await f.auth.beginLogin('/bounties/1/cancel','browser-binding'));const state=required(url.searchParams.get('state'));
 expect(url.searchParams.get('code_challenge_method')).toBe('S256');expect(url.searchParams.get('scope')).toBe('offline_access');
 await expect(f.auth.completeLogin('code',state,'different-browser')).rejects.toThrow();
 const result=await f.auth.completeLogin('code',state,'browser-binding');expect(result.returnTo).toBe('/bounties/1/cancel');expect(result.session.ghId).toBe('4');
 await expect(f.auth.completeLogin('code',state,'browser-binding')).rejects.toThrow();
 const rows=await f.database.orm.select().from(sessions);expect(rows).toHaveLength(1);expect(JSON.stringify(rows)).not.toContain('access-private');expect(JSON.stringify(rows)).not.toContain('refresh-private');expect(JSON.stringify(rows)).not.toContain(result.cookie);
 expect((await f.auth.requireSession(result.cookie)).ghLogin).toBe('maintainer');
 }finally{await f.close();}
});
it.each(['https://evil.example/','//evil.example/','/\\evil.example','/%2f%2fevil.example','/ok\r\nLocation: evil'])('rejects unsafe return path %s',async path=>{
 const f=await fixture();try{await expect(f.auth.beginLogin(path,'browser')).rejects.toThrow();expect(await f.database.orm.select().from(oauthStates)).toHaveLength(0);}finally{await f.close();}
});
it('failed exchange, forged state and expired state create no session',async()=>{
 const f=await fixture();try{
 const state=required(new URL(await f.auth.beginLogin('/','browser-binding')).searchParams.get('state'));
 await expect(f.auth.completeLogin('code',state+'x','browser-binding')).rejects.toThrow();
 f.provider.exchange=()=>Promise.reject(new Error('provider unavailable'));
 await expect(f.auth.completeLogin('code',state,'browser-binding')).rejects.toThrow();
 const expired=required(new URL(await f.auth.beginLogin('/','browser-binding')).searchParams.get('state'));f.advance(601000);
 await expect(f.auth.completeLogin('code',expired,'browser-binding')).rejects.toThrow();
 expect(await f.database.orm.select().from(sessions)).toHaveLength(0);
 }finally{await f.close();}
});
it('concurrent refresh consumes a rotating token once and both requests use new token',async()=>{
 const f=await fixture();try{
 const result=await f.login();f.advance(3600000);
 const values=await Promise.all([f.auth.requireSession(result.cookie),f.auth.requireSession(result.cookie)]);
 expect(values.map(v=>v.accessToken)).toEqual(['rotated-private','rotated-private']);expect(f.counts.refresh).toBe(1);
 expect((await f.database.orm.select().from(sessions))[0]?.tokenGeneration).toBe(1);
 }finally{await f.close();}
});
it('logout while refresh is in flight cannot resurrect the session',async()=>{
 const f=await fixture();try{
 const result=await f.login();f.advance(3600000);
 let release!:()=>void;let started!:()=>void;const gate=new Promise<void>(r=>{release=r;});const entered=new Promise<void>(r=>{started=r;});
 f.provider.refresh=async()=>{started();await gate;return tokens();};
 const pending=f.auth.requireSession(result.cookie);const rejected=expect(pending).rejects.toThrow();await entered;
 await f.auth.logout(result.session.id);release();await rejected;
 expect(await f.database.orm.select().from(sessions)).toHaveLength(0);
 }finally{await f.close();}
});
it('expired refresh and expired sessions require login',async()=>{
 const f=await fixture();try{
 const a=await f.login();f.advance(7200001);await expect(f.auth.requireSession(a.cookie)).rejects.toThrow();
 const b=await f.login();await f.database.orm.update(sessions).set({expiresAt:new Date('2000-01-01')}).where(eq(sessions.id,b.session.id));
 await expect(f.auth.requireSession(b.cookie)).rejects.toThrow();
 }finally{await f.close();}
});
it('failed refresh preserves session on outage but removes confirmed invalid credentials',async()=>{
 const f=await fixture();try{
 const result=await f.login();f.advance(3600000);
 const {AuthError}=await import('../../src/github/oauth.js');
 f.provider.refresh=()=>Promise.reject(new AuthError(503));await expect(f.auth.requireSession(result.cookie)).rejects.toThrow();expect(await f.database.orm.select().from(sessions)).toHaveLength(1);
 f.provider.refresh=()=>Promise.reject(new AuthError(401));await expect(f.auth.requireSession(result.cookie)).rejects.toThrow();expect(await f.database.orm.select().from(sessions)).toHaveLength(0);
 }finally{await f.close();}
});

function required<T>(value:T|null|undefined):T {if(value===null||value===undefined)throw new Error('Missing fixture value');return value;}

it('timed-out refresh lock acquisition destroys the uncertain connection instead of pooling it',async()=>{
 const f=await fixture();const holder=await f.database.pool.connect();
 const timed=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL,options:`-c search_path=${f.database.schemaName}`,query_timeout:100,max:1});
 try {
  const login=await f.login();const key=f.database.schemaName+':refresh:'+login.session.id;
  await holder.query('SELECT pg_advisory_lock(hashtext($1))',[key]);
  const auth=createAuth({...f.database,pool:timed},parseAuthEnv(syntheticEnv()),f.provider,{now:()=>new Date('2026-10-28T01:00:00Z')});
  await expect(auth.requireSession(login.cookie)).rejects.toThrow();
  await holder.query('SELECT pg_advisory_unlock(hashtext($1))',[key]);
  const result=await timed.query<{n:number}>("SELECT count(*)::int AS n FROM pg_locks WHERE pid=pg_backend_pid() AND locktype='advisory'");
  expect(result.rows[0]?.n).toBe(0);expect(f.counts.refresh).toBe(0);
 } finally {await holder.query('SELECT pg_advisory_unlock_all()');holder.release();await timed.end();await f.close();}
});
