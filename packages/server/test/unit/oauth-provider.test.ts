import nock from 'nock';
import { expect,it } from 'vitest';
import { createOAuthProvider } from '../../src/github/oauth.js';
import { parseAuthEnv } from '../../src/env.js';
import { syntheticEnv } from '../helpers/env.js';
import { encrypt,decrypt } from '../../src/util/crypto.js';
const env=parseAuthEnv(syntheticEnv());
it('exchanges PKCE code, validates identity and scopes permissions by stable repository ID',async()=>{
 const provider=createOAuthProvider(env);
 nock('https://github.com').post('/login/oauth/access_token',{code:'code',code_verifier:'verifier',redirect_uri:'http://localhost:3000/oauth/github/callback',client_id:env.GH_CLIENT_ID,client_secret:env.GH_CLIENT_SECRET}).reply(200,{access_token:'user',refresh_token:'refresh',expires_in:28800,refresh_token_expires_in:15897600,token_type:'bearer',scope:''});
 const token=await provider.exchange('code','verifier');expect(token.accessToken).toBe('user');
 nock('https://api.github.com',{reqheaders:{authorization:'Bearer user'}}).get('/user').reply(200,{id:4,login:'maintainer'}).get('/repositories/2').reply(200,{id:2,permissions:{pull:true,push:false,admin:false,maintain:false}});
 expect(await provider.identity(token.accessToken)).toEqual({id:'4',login:'maintainer'});expect(await provider.repository(token.accessToken,'2')).toEqual({id:'2',read:true,write:false});
});
it('malformed token response is unavailable, not confirmed revocation',async()=>{
 const provider=createOAuthProvider(env);nock('https://github.com').post('/login/oauth/access_token').reply(200,{access_token:'partial'});
 await expect(provider.refresh('refresh')).rejects.toMatchObject({status:503});
});
it('confirmed invalid refresh is unauthorized; repository substitution is denied',async()=>{
 const provider=createOAuthProvider(env);nock('https://github.com').post('/login/oauth/access_token').reply(200,{error:'bad_refresh_token'});await expect(provider.refresh('expired')).rejects.toMatchObject({status:401});
 nock('https://api.github.com').get('/repositories/2').reply(200,{id:3,permissions:{pull:true,push:true,admin:true}});await expect(provider.repository('token','2')).rejects.toMatchObject({status:403});
});
it('encrypted credential cannot be moved to another session or purpose',()=>{
 const value=encrypt('private',env.TOKEN_ENC_KEY,'one:access');expect(decrypt(value,env.TOKEN_ENC_KEY,'one:access')).toBe('private');expect(()=>decrypt(value,env.TOKEN_ENC_KEY,'two:access')).toThrow();expect(()=>decrypt(value,env.TOKEN_ENC_KEY,'one:refresh')).toThrow();
});
