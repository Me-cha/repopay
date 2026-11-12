import type { FundingEnv } from '../../src/env.js';
import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { intentFixture } from './funding.js';
import { required } from './auth.js';
import { bounties,copilotSponsors,submissions,submissionEvidence,verifications } from '../../src/db/schema.js';
import { createSettlement } from '../../src/settlement/settle.js';
import { candidateFingerprint,type CandidateScan } from '../../src/settlement/candidates.js';
import { fixtureInput } from '../../src/verifier/evaluate.js';
import { buildVerifierPrompt,PROMPT_VERSION } from '../../src/verifier/prompt.js';
export async function awardFixture(twoAuthors=false,settings:Partial<FundingEnv>={}){
 const f=await intentFixture({method:'paypal'},settings);
 await f.database.orm.update(bounties).set({status:'FUNDED',captureId:'CAPTURE',fundedAt:new Date(),fundedTerms:f.terms}).where(eq(bounties.id,f.bounty.id));
 await f.database.orm.update(copilotSponsors).set({accessExpiresAt:new Date(Date.now()+86400000),refreshExpiresAt:new Date(Date.now()+172800000)}).where(eq(copilotSponsors.repoId,'2'));
 const evidence=new Map<string,ReturnType<typeof fixtureInput>>();
 async function add(prId:string,mergedAt:string,status='DONE'){
  const sub=required((await f.database.orm.insert(submissions).values({bountyId:f.bounty.id,repoId:'2',prId,prNumber:Number(prId),authorGhId:'8',authorLogin:'author',status:'MERGED',headSha:'a'.repeat(40),baseSha:'b'.repeat(40),mergeSha:'c'.repeat(40),mergedAt:new Date(mergedAt),evidenceVersion:1}).returning())[0]);
  const fresh={...fixtureInput({id:prId,title:'Fix',body:'Fix',criteria:'Fix',diff:'fix',sufficient:true,expected:'RESOLVES'}),submissionId:sub.id,bountyId:f.bounty.id};if(twoAuthors)fresh.eligibleAuthors.push({ghId:'9',login:'second'});evidence.set(sub.id,fresh);
  const ev=required((await f.database.orm.insert(submissionEvidence).values({submissionId:sub.id,version:1,headSha:sub.headSha,baseSha:sub.baseSha,testedSha:sub.headSha,title:'Fix',body:'Fix',diffText:'fix',inputTruncated:false,evidenceSufficient:true,eligibleAuthors:fresh.eligibleAuthors,unverifiedAuthors:[],ci:{...fresh.ci},snapshotHash:fresh.snapshotHash}).returning())[0]);
  await f.database.orm.insert(verifications).values({submissionId:sub.id,evidenceId:ev.id,headSha:sub.headSha,attempt:1,status,provider:'copilot',model:f.env.COPILOT_MODEL,sdkVersion:'1.0.28',sponsorGhId:'4',promptHash:createHash('sha256').update(PROMPT_VERSION+'\n'+buildVerifierPrompt(fresh)).digest('hex'),result:{verdict:'RESOLVES',confidence:1,coverage:1,reasoning:'yes',unmet_requirements:[],splits:twoAuthors?[{gh_id:'8',share:0.5,why:'author'},{gh_id:'9',share:0.5,why:'author'}]:[{gh_id:'8',share:1,why:'author'}]}});
  return sub;
 }
 const scan=async():Promise<CandidateScan>=>{const rows=await f.database.orm.select().from(submissions).where(eq(submissions.bountyId,f.bounty.id));const b=required((await f.database.orm.select().from(bounties).where(eq(bounties.id,f.bounty.id)))[0]);return {complete:true,bountyVersion:b.version,submissions:rows,evidence,hash:candidateFingerprint(rows)};};
 const service=createSettlement(f.database,{scan,profileAccepted:()=>Promise.resolve(true)});
 return {...f,add,scan,service};
}
