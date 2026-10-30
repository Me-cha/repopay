import { createHash } from 'node:crypto';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { z } from 'zod';
import type { Database } from '../db/client.js';
import { copilotSponsorStates,copilotSponsors,oauthStates,sessions } from '../db/schema.js';
import type { AuthEnv } from '../env.js';
import type { Clock } from '../domain/types.js';
import { decrypt, encrypt, equalSecret, mac, randomToken, sha256 } from '../util/crypto.js';
import { requestJson } from '../preflight/http.js';
import { apiId } from './handlers.js';
export class AuthError extends Error {
 constructor(readonly status=401, message='Please sign in again.') {super(message);}
}
export interface TokenSet {accessToken:string;refreshToken:string;expiresIn:number;refreshExpiresIn:number}
export interface OAuthProvider {
 exchange(code:string,verifier:string):Promise<TokenSet>;
 refresh(token:string):Promise<TokenSet>;
 identity(token:string):Promise<{id:string;login:string}>;
 repository(token:string,repoId:string):Promise<{id:string;read:boolean;write:boolean;admin?:boolean;ownerId?:string;ownerType?:string}>;
}
const tokenSchema=z.object({access_token:z.string().min(1),refresh_token:z.string().min(1),token_type:z.literal('bearer'),expires_in:z.number().int().positive().max(86400),refresh_token_expires_in:z.number().int().positive().max(31536000)});
export function createOAuthProvider(env:AuthEnv):OAuthProvider {
 async function exchange(fields:Record<string,string>):Promise<TokenSet> {
  const response=await requestJson(env,'https://github.com/login/oauth/access_token',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({client_id:env.GH_CLIENT_ID,client_secret:env.GH_CLIENT_SECRET,...fields})});
  if(response.status>=500)throw new AuthError(503,'GitHub is unavailable. Try again.');
  const error=z.object({error:z.string()}).safeParse(response.body);
  if(error.success&&['bad_verification_code','bad_refresh_token','expired_token','invalid_grant'].includes(error.data.error))throw new AuthError();
  if(response.status!==200||!tokenSchema.safeParse(response.body).success)throw new AuthError(503,'GitHub authentication could not be verified. Try again.');
  const v=tokenSchema.parse(response.body);return {accessToken:v.access_token,refreshToken:v.refresh_token,expiresIn:v.expires_in,refreshExpiresIn:v.refresh_token_expires_in};
 }
 async function get(path:string,token:string) {
  const response=await requestJson(env,'https://api.github.com'+path,{headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','User-Agent':'GitPay','X-GitHub-Api-Version':'2026-03-10'}});
  if(response.status!==200)throw new AuthError(response.status===401?401:response.status===404||response.status===403?403:503,'GitHub access could not be verified.');return response.body;
 }
 return {
  exchange:(code,verifier)=>exchange({code,code_verifier:verifier,redirect_uri:new URL('/oauth/github/callback',env.PUBLIC_URL).href}),
  refresh:token=>exchange({grant_type:'refresh_token',refresh_token:token}),
  identity:async token=>z.object({id:apiId,login:z.string().min(1).max(100)}).parse(await get('/user',token)),
  repository:async(token,repoId)=>{
   const v=z.object({id:apiId,owner:z.object({id:apiId,type:z.string()}).optional(),permissions:z.object({pull:z.boolean(),push:z.boolean(),admin:z.boolean(),maintain:z.boolean().optional()})}).parse(await get('/repositories/'+repoId,token));
   if(v.id!==repoId)throw new AuthError(403,'Repository access could not be verified.');
   return {id:v.id,read:v.permissions.pull,write:v.permissions.push||v.permissions.admin||v.permissions.maintain===true,...(v.permissions.admin?{admin:true}:{}),...(v.owner?{ownerId:v.owner.id,ownerType:v.owner.type}:{})};
  },
 };
}
export function localReturnTo(value:string):string {
 for(const c of value)if(c.charCodeAt(0)<32||c.charCodeAt(0)===127)throw new AuthError(400,'Invalid return address.');
 if(value.length>2048||!value.startsWith('/')||value.startsWith('//')||/[\\\s]/.test(value)||/%(?:2f|5c|0[0-9a-f]|1[0-9a-f]|7f|25)/i.test(value))throw new AuthError(400,'Invalid return address.');
 const parsed=new URL(value,'https://gitpay.invalid');if(parsed.origin!=='https://gitpay.invalid')throw new AuthError(400,'Invalid return address.');return parsed.pathname+parsed.search;
}
type SessionRow=typeof sessions.$inferSelect;
type SponsorRow=typeof copilotSponsors.$inferSelect;
export type LocalSession=Pick<Session,'id'|'ghId'|'ghLogin'|'csrfSecret'>;
export interface Session {id:string;ghId:string;ghLogin:string;csrfSecret:string;accessToken:string;tokenGeneration:number}
export function createAuth(db:Database,env:AuthEnv,provider:OAuthProvider=createOAuthProvider(env),clock:Clock={now:()=>new Date()}) {
 const origin=new URL(env.PUBLIC_URL).origin;
 const encrypted=(id:string,t:TokenSet)=>({accessTokenEnc:encrypt(t.accessToken,env.TOKEN_ENC_KEY,id+':access'),refreshTokenEnc:encrypt(t.refreshToken,env.TOKEN_ENC_KEY,id+':refresh'),accessExpiresAt:new Date(clock.now().getTime()+t.expiresIn*1000),refreshExpiresAt:new Date(clock.now().getTime()+t.refreshExpiresIn*1000)});
 function materialize(row:SessionRow):Session {return {id:row.id,ghId:row.ghId,ghLogin:row.ghLogin,csrfSecret:row.csrfSecret,accessToken:decrypt(row.accessTokenEnc,env.TOKEN_ENC_KEY,row.id+':access'),tokenGeneration:row.tokenGeneration};}
 function materializeSponsor(row:SponsorRow) {return {repoId:row.repoId,installationId:row.installationId,sponsorGhId:row.sponsorGhId,sponsorLogin:row.sponsorLogin,accessToken:decrypt(row.accessTokenEnc,env.TOKEN_ENC_KEY,row.repoId+':copilot-access'),modelId:row.modelId,modelVerifiedAt:row.modelVerifiedAt,revokedAt:row.revokedAt};}
 async function beginLogin(returnTo:string,browserBinding:string) {
  const path=localReturnTo(returnTo),nonce=randomToken(),verifier=randomToken();const nonceHash=sha256(nonce);
  await db.orm.insert(oauthStates).values({nonceHash,browserBindingHash:sha256(browserBinding),returnTo:path,verifierEnc:encrypt(verifier,env.TOKEN_ENC_KEY,nonceHash+':pkce'),expiresAt:new Date(clock.now().getTime()+env.OAUTH_STATE_TTL_SEC*1000)});
  const url=new URL('https://github.com/login/oauth/authorize');url.search=new URLSearchParams({client_id:env.GH_CLIENT_ID,redirect_uri:origin+'/oauth/github/callback',state:nonce+'.'+mac(env.SESSION_SECRET,nonce),scope:'offline_access',code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'}).toString();return url.href;
 }
 async function completeLogin(code:string,state:string,browserBinding:string) {
  const [nonce='',signature='',...extra]=state.split('.');if(extra.length||!/^[-\w]{43}$/.test(nonce)||!equalSecret(signature,mac(env.SESSION_SECRET,nonce))||!code||code.length>1024)throw new AuthError(400,'Invalid or expired login. Start again.');
  const [stored]=await db.orm.update(oauthStates).set({usedAt:clock.now()}).where(and(eq(oauthStates.nonceHash,sha256(nonce)),eq(oauthStates.browserBindingHash,sha256(browserBinding)),isNull(oauthStates.usedAt),gt(oauthStates.expiresAt,clock.now()))).returning();
  if(!stored)throw new AuthError(400,'Invalid or expired login. Start again.');
  const token=await provider.exchange(code,decrypt(stored.verifierEnc,env.TOKEN_ENC_KEY,stored.nonceHash+':pkce'));
  const user=await provider.identity(token.accessToken);const cookie=randomToken(),id=sha256(cookie);
  const [row]=await db.orm.insert(sessions).values({id,ghId:user.id,ghLogin:user.login,...encrypted(id,token),csrfSecret:randomToken(),expiresAt:new Date(clock.now().getTime()+env.SESSION_TTL_SEC*1000)}).returning();
  if(!row)throw new AuthError();return {session:materialize(row),cookie,returnTo:stored.returnTo};
 }
 async function beginCopilotSponsor(repoId:string,installationId:string,returnTo:string,session:Session,browserBinding:string) {
  const path=localReturnTo(returnTo),nonce=randomToken(),verifier=randomToken(),nonceHash=sha256(nonce);
  await db.orm.insert(copilotSponsorStates).values({nonceHash,browserBindingHash:sha256(browserBinding),sessionId:session.id,actorGhId:session.ghId,repoId,installationId,returnTo:path,verifierEnc:encrypt(verifier,env.TOKEN_ENC_KEY,nonceHash+':copilot-pkce'),expiresAt:new Date(clock.now().getTime()+env.OAUTH_STATE_TTL_SEC*1000)});
  // Reuse the GitHub App's registered OAuth callback URL. The callback router
  // dispatches to the sponsor handler when the sponsor browser-binding cookie
  // is present, so customers do not need to change their app configuration.
  const url=new URL('https://github.com/login/oauth/authorize');url.search=new URLSearchParams({client_id:env.GH_CLIENT_ID,redirect_uri:origin+'/oauth/github/callback',state:nonce+'.'+mac(env.SESSION_SECRET,nonce),scope:'offline_access',code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'}).toString();
  return url.href;
 }
 async function completeCopilotSponsor(code:string,state:string,browserBinding:string,session:Session) {
  const [nonce='',signature='',...extra]=state.split('.');if(extra.length||!/^[-\w]{43}$/.test(nonce)||!equalSecret(signature,mac(env.SESSION_SECRET,nonce))||!code||code.length>1024)throw new AuthError(400,'Invalid or expired sponsor authorization. Start again.');
  const [stored]=await db.orm.update(copilotSponsorStates).set({usedAt:clock.now()}).where(and(eq(copilotSponsorStates.nonceHash,sha256(nonce)),eq(copilotSponsorStates.browserBindingHash,sha256(browserBinding)),eq(copilotSponsorStates.sessionId,session.id),eq(copilotSponsorStates.actorGhId,session.ghId),isNull(copilotSponsorStates.usedAt),gt(copilotSponsorStates.expiresAt,clock.now()))).returning();
  if(!stored)throw new AuthError(400,'Invalid or expired sponsor authorization. Start again.');
  const token=await provider.exchange(code,decrypt(stored.verifierEnc,env.TOKEN_ENC_KEY,stored.nonceHash+':copilot-pkce'));
  const user=await provider.identity(token.accessToken);if(user.id!==session.ghId)throw new AuthError(403,'Authorize the same GitHub account that is signed in to GitPay.');
  const repository=await provider.repository(token.accessToken,stored.repoId);
  if(repository.id!==stored.repoId||repository.ownerId!==user.id||repository.ownerType!=='User'||repository.admin!==true)throw new AuthError(403,'Only the owner of a personal repository can sponsor its Copilot reviews.');
  return {repoId:stored.repoId,installationId:stored.installationId,returnTo:stored.returnTo,user,token};
 }
 async function saveCopilotSponsor(input:{repoId:string;installationId:string;user:{id:string;login:string};token:TokenSet;modelId:string}) {
  if(!input.modelId)throw new AuthError(409,'GitPay requires a Copilot model or auto.');
  const id=input.repoId,now=clock.now();
  const values={repoId:id,installationId:input.installationId,sponsorGhId:input.user.id,sponsorLogin:input.user.login,
   accessTokenEnc:encrypt(input.token.accessToken,env.TOKEN_ENC_KEY,id+':copilot-access'),refreshTokenEnc:encrypt(input.token.refreshToken,env.TOKEN_ENC_KEY,id+':copilot-refresh'),
   accessExpiresAt:new Date(now.getTime()+input.token.expiresIn*1000),refreshExpiresAt:new Date(now.getTime()+input.token.refreshExpiresIn*1000),tokenGeneration:0,
   modelId:input.modelId,modelVerifiedAt:now,revokedAt:null,updatedAt:now};
  await db.orm.insert(copilotSponsors).values(values).onConflictDoUpdate({target:copilotSponsors.repoId,set:{...values,tokenGeneration:sql`${copilotSponsors.tokenGeneration}+1`}});
 }
 async function revokeCopilotSponsor(repoId:string) {await db.orm.update(copilotSponsors).set({revokedAt:clock.now(),updatedAt:clock.now()}).where(eq(copilotSponsors.repoId,repoId));}
 async function getCopilotSponsor(repoId:string) {
  const [row]=await db.orm.select().from(copilotSponsors).where(eq(copilotSponsors.repoId,repoId));
  if(!row||row.revokedAt)throw new AuthError(409,'Connect a Copilot sponsor for this repository before funding.');
  if(row.accessExpiresAt.getTime()>clock.now().getTime()+60000)return materializeSponsor(row);
  const client=await db.pool.connect(),lock=db.schemaName+':copilot-refresh:'+repoId;let acquired=false;
  try {
   await client.query('select pg_advisory_lock(hashtext($1))',[lock]);acquired=true;const orm=drizzle(client);
   const [current]=await orm.select().from(copilotSponsors).where(eq(copilotSponsors.repoId,repoId));
   if(!current||current.revokedAt)throw new AuthError(409,'Reconnect the Copilot sponsor for this repository.');
   if(current.accessExpiresAt.getTime()>clock.now().getTime()+60000)return materializeSponsor(current);
   const same=and(eq(copilotSponsors.repoId,repoId),eq(copilotSponsors.tokenGeneration,current.tokenGeneration),isNull(copilotSponsors.revokedAt));
   if(current.refreshExpiresAt<=clock.now())throw new AuthError(409,'Reconnect the Copilot sponsor for this repository.');
   let next:TokenSet;try{next=await provider.refresh(decrypt(current.refreshTokenEnc,env.TOKEN_ENC_KEY,repoId+':copilot-refresh'));}catch(error){if(error instanceof AuthError&&error.status===401){await orm.update(copilotSponsors).set({revokedAt:clock.now(),updatedAt:clock.now()}).where(same);throw new AuthError(409,'Reconnect the Copilot sponsor for this repository.');}throw error;}
   const [updated]=await orm.update(copilotSponsors).set({accessTokenEnc:encrypt(next.accessToken,env.TOKEN_ENC_KEY,repoId+':copilot-access'),refreshTokenEnc:encrypt(next.refreshToken,env.TOKEN_ENC_KEY,repoId+':copilot-refresh'),accessExpiresAt:new Date(clock.now().getTime()+next.expiresIn*1000),refreshExpiresAt:new Date(clock.now().getTime()+next.refreshExpiresIn*1000),tokenGeneration:current.tokenGeneration+1,updatedAt:clock.now()}).where(same).returning();
   if(!updated)throw new AuthError(409,'Reconnect the Copilot sponsor for this repository.');return materializeSponsor(updated);
  } finally {
   let released=false;if(acquired){try{const result=await client.query<{unlocked:boolean}>('select pg_advisory_unlock(hashtext($1)) as unlocked',[lock]);released=result.rows[0]?.unlocked===true;}catch{/* Destroy below. */}}client.release(!released);
  }
 }
 async function requireLocalSession(cookie:string|undefined):Promise<LocalSession> {
  if(!cookie||!/^[-\w]{43}$/.test(cookie))throw new AuthError();
  const [row]=await db.orm.select().from(sessions).where(eq(sessions.id,sha256(cookie)));
  if(!row||row.expiresAt<=clock.now())throw new AuthError();
  return {id:row.id,ghId:row.ghId,ghLogin:row.ghLogin,csrfSecret:row.csrfSecret};
 }
 async function requireSession(cookie:string|undefined):Promise<Session> {
  if(!cookie||!/^[-\w]{43}$/.test(cookie))throw new AuthError();const id=sha256(cookie);
  const [row]=await db.orm.select().from(sessions).where(eq(sessions.id,id));
  if(!row||row.expiresAt<=clock.now())throw new AuthError();
  if(row.accessExpiresAt.getTime()>clock.now().getTime()+60000)return materialize(row);
  const client=await db.pool.connect();const lock=db.schemaName+':refresh:'+id;let acquired=false;
  try {
   // Session-level lock, not a SQL transaction: refresh rotates provider credentials.
   await client.query('select pg_advisory_lock(hashtext($1))',[lock]);acquired=true;const orm=drizzle(client);
   const [current]=await orm.select().from(sessions).where(eq(sessions.id,id));
   if(!current||current.expiresAt<=clock.now())throw new AuthError();
   if(current.accessExpiresAt.getTime()>clock.now().getTime()+60000)return materialize(current);
   const same=and(eq(sessions.id,id),eq(sessions.tokenGeneration,current.tokenGeneration));
   if(current.refreshExpiresAt<=clock.now()){await orm.delete(sessions).where(same);throw new AuthError();}
   let next:TokenSet;
   try {next=await provider.refresh(decrypt(current.refreshTokenEnc,env.TOKEN_ENC_KEY,id+':refresh'));}
   catch(error){if(error instanceof AuthError&&error.status===401)await orm.delete(sessions).where(same);throw error;}
   const [updated]=await orm.update(sessions).set({...encrypted(id,next),tokenGeneration:current.tokenGeneration+1}).where(and(same,gt(sessions.expiresAt,clock.now()))).returning();
   if(!updated)throw new AuthError();return materialize(updated);
  } finally {
   // A pg query timeout does not cancel active SQL. Never pool a connection
   // whose acquisition or release might still be running. Closing releases locks.
   let released=false;
   if(acquired){try{const result=await client.query<{unlocked:boolean}>('select pg_advisory_unlock(hashtext($1)) as unlocked',[lock]);released=result.rows[0]?.unlocked===true;}catch{/* Destroy below. */}}
   client.release(!released);
  }
 }
 return {beginLogin,completeLogin,beginCopilotSponsor,completeCopilotSponsor,saveCopilotSponsor,revokeCopilotSponsor,getCopilotSponsor,requireSession,requireLocalSession,provider,clock,async logout(id:string){await db.orm.delete(sessions).where(eq(sessions.id,id));}};
}
export type AuthService=ReturnType<typeof createAuth>;
