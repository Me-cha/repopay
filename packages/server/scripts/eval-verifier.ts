import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import { summarizeEvaluation } from '../src/verifier/evaluation.js';
import { PROMPT_VERSION } from '../src/verifier/prompt.js';
import { COPILOT_SDK_VERSION } from '../src/models/copilot.js';

const verdict=z.enum(['RESOLVES','PARTIAL','DOES_NOT_RESOLVE']);
const fixture=z.object({id:z.string().min(1),title:z.string(),body:z.string(),criteria:z.string(),diff:z.string(),sufficient:z.boolean(),expected:verdict}).strict();
const input=z.object({model:z.string().min(1),promptVersion:z.string().min(1),sdkVersion:z.string().min(1),observations:z.array(z.object({caseId:z.string().min(1),attempts:z.array(z.object({verdict,payable:z.boolean(),elapsedMs:z.number(),totalNanoAiu:z.number().nullable(),totalPremiumRequestCost:z.number().nullable()}).strict())}).strict())}).strict();
const fixtures=fixture.array().parse(JSON.parse(await readFile(new URL('../test/fixtures/verifier/cases.json',import.meta.url),'utf8')));
const reportArg=process.argv.indexOf('--report');
if(reportArg<0||!process.argv[reportArg+1]){
 process.stdout.write(`${JSON.stringify({status:'fixtures_ready_fixed_model_live_evaluation_not_run',model:process.env.COPILOT_MODEL||null,promptVersion:PROMPT_VERSION,sdkVersion:COPILOT_SDK_VERSION,requiredRunsPerCase:3,requiredCalls:fixtures.length*3,cases:fixtures.map(({id,expected,sufficient})=>({id,expected,sufficient})),costTelemetry:'Live reports require SDK-reported nano-AIU and premium-request metrics; these are Copilot billing units, not USD.'},null,2)}\n`);
} else {
 const reportPath=process.argv[reportArg+1];
 if(!reportPath)throw new Error('A report path is required after --report.');
 const raw=input.parse(JSON.parse(await readFile(resolve(reportPath),'utf8')));
 const report=summarizeEvaluation({model:raw.model,promptVersion:raw.promptVersion,sdkVersion:raw.sdkVersion,cases:fixtures.map(row=>({id:row.id,expected:row.expected,sufficient:row.sufficient})),observations:raw.observations});
 process.stdout.write(`${JSON.stringify(report,null,2)}\n`);
 if(!report.passed)process.exitCode=1;
}
