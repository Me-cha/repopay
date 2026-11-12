import { createHash } from 'node:crypto';
import type { CopilotEnv } from '../env.js';
import { completeCopilot,type CopilotStage,type RuntimeFactory } from '../models/copilot.js';
import { buildVerifierPrompt,PROMPT_VERSION } from './prompt.js';
import { validateVerdictForAuthors,verdictSchema } from './schema.js';
import type { VerifyInput } from './collect.js';

export async function verify(input:VerifyInput,env:CopilotEnv,factory?:RuntimeFactory,signal?:AbortSignal,onStage?:(stage:CopilotStage|'verifier_author_validation')=>void) {
 const prompt=buildVerifierPrompt(input),promptHash=createHash('sha256').update(PROMPT_VERSION+'\n'+prompt).digest('hex');
 const result=await completeCopilot(env,prompt,verdictSchema,factory,signal,onStage);
 onStage?.('verifier_author_validation');
 const value=validateVerdictForAuthors(result.value,input.eligibleAuthors);
 return {...result,value,promptHash,promptVersion:PROMPT_VERSION};
}
