import { vi } from 'vitest';
import type { GitHub, Comment, Installation } from '../../src/github/app.js';
import { parseGitHubRuntimeEnv } from '../../src/env.js';
import { syntheticEnv } from './env.js';
import { createTestDatabase } from './database.js';
import { migrateDatabase } from '../../src/db/migrate.js';
import { enqueue, claimJob } from '../../src/jobs/queue.js';
import type { Work } from '../../src/jobs/kinds.js';
export const testEnv=parseGitHubRuntimeEnv(syntheticEnv());
export function fakeGitHub() {
 const comments:Comment[]=[];
 const state={installation:{id:'1',app_id:testEnv.GH_APP_ID,account:{id:'10',login:'owner'},suspended_at:null} as Installation|null,permission:'write' as 'write'|'read'|'none',lostResponse:false};
 const repo={id:'2',full_name:'owner/repo',archived:false};
 const api:GitHub={
  installation:vi.fn<GitHub['installation']>(()=>Promise.resolve(state.installation)),repository:vi.fn<GitHub['repository']>(()=>Promise.resolve(repo)),issue:vi.fn(async()=>{}),permission:vi.fn<GitHub['permission']>(()=>Promise.resolve(state.permission)),
  comments:vi.fn<GitHub['comments']>(()=>Promise.resolve(comments)),
  createComment:vi.fn<GitHub['createComment']>((_inst,_repo,_number,body)=>{const c={id:String(comments.length+100),body,user:{id:'99',type:'Bot'},performed_via_github_app:{id:testEnv.GH_APP_ID}};comments.push(c);if(state.lostResponse){state.lostResponse=false;return Promise.reject(new Error('lost response'));}return Promise.resolve(c);}),
  updateComment:vi.fn<GitHub['updateComment']>((_inst,_repo,id,body)=>{const comment=comments.find(c=>c.id===id);if(!comment)throw new Error('missing');comment.body=body;return Promise.resolve();}),badge:vi.fn(async()=>{}),
 };
 return {api,state,comments};
}
export async function githubFixture() {
 const f=await createTestDatabase();await migrateDatabase(f.database);
 let occurrence=0;
 return {...f,...fakeGitHub(), async job(work:Work){occurrence++;await f.database.withTransaction(tx=>enqueue(tx,{kind:work.kind,payload:work,dedupeKey:`test:${String(occurrence)}`,maxAttempts:3}));const job=await claimJob(f.database,'test-worker',120);if(!job)throw new Error('missing job');return job;}};
}
export const createWork=(overrides:Partial<Extract<Work,{kind:'run_command'}>>={}):Extract<Work,{kind:'run_command'}>=>({kind:'run_command',installationId:'1',repoId:'2',issueNumber:12,actorId:'4',commentId:'3',command:{kind:'create',amount:'50'},...overrides});
