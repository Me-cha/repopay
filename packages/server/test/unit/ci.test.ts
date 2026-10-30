import { expect,it } from 'vitest';
import { normalizeCi } from '../../src/github/ci.js';
import type { CheckRun } from '../../src/github/app.js';
const sha='a'.repeat(40);
const run=(id:string,name:string,status:CheckRun['status'],conclusion:string|null,appId='51',headSha=sha):CheckRun=>({id,name,status,conclusion,head_sha:headSha,app:{id:appId}});
it('uses the latest rerun per app and context while retaining failures from other contexts',()=>{
 const input={sha,runs:[run('1','unit','completed','failure'),run('2','unit','completed','success')],complete:true,required:[{name:'unit',appId:'51'}],requiredEnabled:true,ownAppId:'99'};
 expect(normalizeCi(input).status).toBe('pass');
 expect(normalizeCi({...input,runs:[...input.runs,run('3','lint','completed','failure')]}).status).toBe('fail');
 expect(normalizeCi({...input,runs:[...input.runs,run('3','unit','in_progress',null)]}).status).toBe('pending');
});
it('requires trusted external check provenance and exact SHA for required CI',()=>{
 const ci=normalizeCi({sha,runs:[run('1','unit','completed','success','51'),run('2','unit','completed','success','99')],complete:true,required:[{name:'unit',appId:'51'}],requiredEnabled:true,ownAppId:'99'});
 expect(ci).toMatchObject({status:'pass',testedSha:sha,externalSuccessCount:1,required:[{name:'unit',appId:'51',status:'pass'}]});
});
it('does not count GitPay, stale SHA, skipped or neutral checks as successful required CI',()=>{
 const ci=normalizeCi({sha,runs:[run('1','unit','completed','success','99'),run('2','stale','completed','success','51','b'.repeat(40)),run('3','unit','completed','skipped','51')],complete:true,required:[{name:'unit',appId:'51'}],requiredEnabled:true,ownAppId:'99'});
 expect(ci.status).not.toBe('pass');expect(ci.externalSuccessCount).toBe(0);
});
it('marks pagination or missing required contexts pending rather than successful',()=>{
 expect(normalizeCi({sha,runs:[run('1','unit','completed','success')],complete:false,required:[],requiredEnabled:false,ownAppId:'99'}).status).toBe('pending');
 expect(normalizeCi({sha,runs:[],complete:true,required:[{name:'unit',appId:'51'}],requiredEnabled:true,ownAppId:'99'}).status).toBe('pending');
});
