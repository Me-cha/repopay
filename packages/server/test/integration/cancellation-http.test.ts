import { expect,it } from 'vitest';
import { cancellationFixture } from '../helpers/cancellation.js';
import { csrfFrom,form } from '../helpers/auth.js';
import { cancellationRequests,refundIntents } from '../../src/db/schema.js';
it('authenticated request page enforces CSRF and does not refund; non-operator cannot review',async()=>{const f=await cancellationFixture();try{const path='/bounties/'+f.bounty.id+'/cancellation',page=await f.requestPage(path);expect(page.status).toBe(200);const csrf=csrfFrom(await page.text());const bad=await f.requestPage(path,form('invalid',{reasonCategory:f.input.reasonCategory,reason:f.input.reason,links:f.input.links.join('\n')}));expect(bad.status).toBe(403);const posted=await f.requestPage(path,form(csrf,{reasonCategory:f.input.reasonCategory,reason:f.input.reason,links:f.input.links.join('\n')}));expect(posted.status).toBe(303);const target=posted.headers.get('location')??'';const view=await f.requestPage(target);expect(view.status).toBe(200);expect(await view.text()).toContain('Not yet published');expect(await f.database.orm.select().from(refundIntents)).toHaveLength(0);expect(await f.database.orm.select().from(cancellationRequests)).toHaveLength(1);}finally{await f.close();}});
it('independent operator browser preview binds a single-use decision and rejects amount substitution',async()=>{const f=await cancellationFixture(true);try{
 const r=await f.request();await f.cancellation.publish(r.id);
 await f.database.pool.query("UPDATE cancellation_requests SET notice_published_at=now()-interval '73 hours',notice_ends_at=now()-interval '1 hour' WHERE id=$1",[r.id]);
 f.providerIdentityForOperator();
 const loginUrl=new URL(await f.auth.beginLogin('/cancellations/'+r.id,'operator-binding'));
 const login=await f.auth.completeLogin('operator-code',loginUrl.searchParams.get('state')??'','operator-binding');
 const request=(path:string,options:RequestInit={})=>{const headers=new Headers(options.headers);headers.set('Cookie','gitpay_session='+login.cookie);return f.requestPage(path,{...options,headers});};
 const path='/cancellations/'+r.id,page=await request(path),csrf=csrfFrom(await page.text());
 const v=await f.cancellation.refresh(r.id),fields:Record<string,string>={decision:'approve',reason:'The independently observed earlier fix resolves the original criteria.',checklist:'confirmed',nextUpdateAt:''};
 for(const c of v.bundle.claims){fields['basis:'+c.key]='unrelated';fields['reason:'+c.key]='This reference is the earlier independent fix, not an external contribution claim.';}
 const preview=await request(path+'/review',form(csrf,fields));expect(preview.status).toBe(303);const target=preview.headers.get('location')??'';const confirm=await request(target);expect(confirm.status).toBe(200);const confirmCsrf=csrfFrom(await confirm.text());
 expect((await request(target,form(confirmCsrf,{amountCents:'1'}))).status).not.toBe(303);
 expect((await request(target,form(confirmCsrf))).status).toBe(303);expect((await f.cancellation.load(r.id)).status).toBe('APPROVED');expect((await request(target,form(confirmCsrf))).status).toBe(409);expect(await f.database.orm.select().from(refundIntents)).toHaveLength(0);
 }finally{await f.close();}});
