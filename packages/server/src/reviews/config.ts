import { z } from 'zod';

const key=z.string().regex(/^[A-Za-z0-9+/]{43}=$/);
export const artifactVersion='review-execution-v1';
export const reviewSettings=z.object({
 REVIEW_BACKEND:z.enum(['shared','dedicated','render']).default('shared'),
 REVIEW_EXECUTOR_KEY:key.optional(),
 REVIEW_GENERATION:z.coerce.number().int().positive().default(1),
 RENDER_API_KEY:z.string().min(20).optional(),
 RENDER_REVIEW_TASK:z.string().regex(/^[a-z0-9-]+\/verifySubmission:[A-Za-z0-9._-]+$/).optional(),
});
export type ReviewSettings=z.infer<typeof reviewSettings>;
export function parseReviewSettings(input:Record<string,string|undefined>):ReviewSettings {
 const result=reviewSettings.safeParse(input);
 if(!result.success)throw new Error('Invalid review execution configuration');
 const value=result.data;
 if(value.REVIEW_BACKEND!=='shared'&&!value.REVIEW_EXECUTOR_KEY)throw new Error('Review executor authentication required');
 if(value.REVIEW_BACKEND==='render'&&(!value.RENDER_API_KEY||!value.RENDER_REVIEW_TASK))throw new Error('Render API key and versioned task required');
 return value;
}
export function parseExecutorSettings(input:Record<string,string|undefined>){
 if(input.REVIEW_BROKER_URL)throw new Error('Invalid isolated review executor configuration: use PUBLIC_URL');
 for(const name of ['DATABASE_URL','TEST_DATABASE_URL','PP_SECRET','PP_CLIENT_SECRET','TOKEN_ENC_KEY','PAYMENT_DATA_ENC_KEY','GH_PRIVATE_KEY','GH_PRIVATE_KEY_PATH','RENDER_API_KEY','COPILOT_GITHUB_TOKEN']){
  if(input[name])throw new Error('Broad application credentials are forbidden in the isolated executor');
 }
 const result=z.object({
  PUBLIC_URL:z.url().refine(value=>{const u=new URL(value);return !u.username&&!u.password&&!u.search&&!u.hash&&u.pathname==='/'&&(u.protocol==='https:'||(u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname)));}),
  REVIEW_EXECUTOR_KEY:key,
  REVIEW_GENERATION:z.coerce.number().int().positive(),
  REVIEW_BACKEND:z.enum(['dedicated','render']),
 }).safeParse(input);
 if(!result.success)throw new Error('Invalid isolated review executor configuration');
 return result.data;
}
export type ExecutorSettings=ReturnType<typeof parseExecutorSettings>;
