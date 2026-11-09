import { expect,it } from 'vitest';
import nock from 'nock';
import { readRenderRun,renderTasks } from '../../src/reviews/render.js';

it('sends metadata-only, version-pinned starts with the durable idempotency key',async()=>{
 const dispatchId='00f89763-38cf-42b3-bd5c-6a5866486692',task='repopay-reviews/verifySubmission:abc';
 nock('https://api.render.com').post('/v1/task-runs',{task,input:[{dispatchId}],idempotencyKey:dispatchId}).matchHeader('authorization','Bearer test-key').reply(202,{id:'tr-example'});
 expect(await renderTasks('test-key').start(task,dispatchId)).toBe('tr-example');
 nock('https://api.render.com').get('/v1/task-runs/tr-example').reply(200,{id:'tr-example',status:'completed',input:[{dispatchId}],results:[{status:'result_saved'}]});
 expect(await readRenderRun('test-key','tr-example')).toEqual({id:'tr-example',status:'completed',input:[{dispatchId}]});
});
it('treats throttling, mismatched identity and unknown status as unresolved',async()=>{
 nock('https://api.render.com').post('/v1/task-runs').reply(429,{message:'rate limited'});
 await expect(renderTasks('test-key').start('review/verifySubmission:abc','id')).rejects.toThrow('unresolved');
 nock('https://api.render.com').get('/v1/task-runs/tr-example').reply(200,{id:'wrong',status:'completed',input:[]});
 await expect(renderTasks('test-key').status('tr-example')).rejects.toThrow();
 nock('https://api.render.com').get('/v1/task-runs/tr-example').reply(200,{id:'tr-example',status:'unknown',input:[]});
 await expect(renderTasks('test-key').status('tr-example')).rejects.toThrow();
});
