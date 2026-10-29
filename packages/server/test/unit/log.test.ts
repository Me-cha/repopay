import { Writable } from 'node:stream';
import { expect, it } from 'vitest';
import { parseEnv, parseCopilotEnv } from '../../src/env.js';
import { createLogger } from '../../src/log.js';
import { syntheticEnv } from '../helpers/env.js';
it('redaction_removes_nested_secrets and safe errors', () => {
  let output = '';
  const stream = new Writable({ write(chunk: Buffer, _encoding, done) { output += chunk.toString(); done(); } });
  const env = parseEnv(syntheticEnv());
  const log = createLogger(env, stream);
  log.info({ requestId: 'safe-id', nested: [{ access_token: 'secret-token', cookie: 'secret-cookie', email: 'private@example.com', GH_PRIVATE_KEY: 'secret-pem' }], err: new Error('password=secret-error') }, `hello private@example.com ${env.PP_SECRET}`);
  expect(output).toContain('safe-id');
  for (const secret of ['secret-token', 'secret-cookie', 'private@example.com', 'secret-pem', 'secret-error', env.PP_SECRET]) expect(output).not.toContain(secret);
});
it('redacts child bindings and setBindings', () => {
  let output = '';
  const stream = new Writable({ write(chunk: Buffer, _encoding, done) { output += chunk.toString(); done(); } });
  const log = createLogger(parseEnv(syntheticEnv()), stream);
  const child = log.child({ authorization: 'Bearer child-secret', email: 'child@example.com', nested: { token: 'nested-child-token' }, requestId: 'safe-child' });
  child.setBindings({ cookie: 'binding-cookie', nested: [{ email: 'binding@example.com' }] });
  child.info({ event: 'child_test' });
  expect(output).toContain('safe-child');
  for (const secret of ['child-secret', 'child@example.com', 'nested-child-token', 'binding-cookie', 'binding@example.com']) expect(output).not.toContain(secret);
});
it('redacts API key fields and configured key values in messages', () => {
  let output = '';
  const stream = new Writable({ write(chunk: Buffer, _encoding, done) { output += chunk.toString(); done(); } });
  const env = parseCopilotEnv(syntheticEnv());
  const log = createLogger(env, stream);
  log.info({ COPILOT_GITHUB_TOKEN: env.COPILOT_GITHUB_TOKEN, nested: { 'x-api-key': 'arbitrary-api-key' } }, `echo ${env.COPILOT_GITHUB_TOKEN}`);
  expect(output).not.toContain(env.COPILOT_GITHUB_TOKEN);
  expect(output).not.toContain('arbitrary-api-key');
});
it('redacts action URLs, OAuth callback codes and CSRF values',()=>{
 let output='';const stream=new Writable({write(chunk:Buffer,_encoding,done){output+=chunk.toString();done();}});
 const log=createLogger(parseEnv(syntheticEnv()),stream);
 log.info({url:'/a/private-action?csrf=private-csrf',returnTo:'%2Fa%2Fencoded-action',code:'private-code',state:'private-state'},'GET /oauth/github/callback?code=callback-code&state=callback-state');
 for(const secret of ['private-action','private-csrf','encoded-action','private-code','private-state','callback-code','callback-state'])expect(output).not.toContain(secret);
});
