import { expect,it } from 'vitest';
import { authFixture,form } from '../helpers/auth.js';
const path='/api/onboarding/dashboard';
it('claims the tour once per account across concurrent requests and new sessions',async()=>{
 const f=await authFixture();try{
  const initial=await f.request(path);expect(initial.status).toBe(200);
  const body=await initial.json() as {seen:boolean;csrf:string};expect(body.seen).toBe(false);
  const results=await Promise.all(Array.from({length:4},async()=>{const r=await f.request(path,form(body.csrf));expect(r.status).toBe(200);return await r.json() as {show:boolean};}));
  expect(results.filter(r=>r.show)).toHaveLength(1);
  const start=new URL(await f.auth.beginLogin('/dashboard','new-browser'));
  const login=await f.auth.completeLogin('code',start.searchParams.get('state')??'','new-browser');
  expect(await(await f.request(path,{headers:{Cookie:'repopay_session='+login.cookie}})).json()).toMatchObject({seen:true});
  f.provider.identity=()=>Promise.resolve({id:'99',login:'another-user'});
  const otherStart=new URL(await f.auth.beginLogin('/dashboard','other'));
  const other=await f.auth.completeLogin('code',otherStart.searchParams.get('state')??'','other');
  expect(await(await f.request(path,{headers:{Cookie:'repopay_session='+other.cookie}})).json()).toMatchObject({seen:false});
 }finally{await f.close();}
});
it('rejects anonymous, cross-origin and caller-selected identities without consuming the tour',async()=>{
 const f=await authFixture();try{
  expect((await f.request(path,{headers:{Cookie:''}})).status).toBe(401);
  const response=await f.request(path);expect(response.status).toBe(200);
  const body=await response.json() as {csrf:string};
  expect((await f.request(path,{method:'POST'})).status).toBe(403);
  expect((await f.request(path,{...form(body.csrf),headers:{...form(body.csrf).headers,Origin:'https://evil.example'}})).status).toBe(403);
  expect((await f.request(path,form(body.csrf,{ghId:'99'}))).status).toBe(400);
  expect(await(await f.request(path)).json()).toMatchObject({seen:false});
 }finally{await f.close();}
});
