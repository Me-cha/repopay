import { verdictSchema,type Verdict } from '../verifier/schema.js';
import { allocate,integerWeight,type Allocation } from './allocate.js';

export interface PolicyInput {
 bountyCents:number;verdict:Verdict;ci:'pass'|'fail'|'pending'|'none';eligible:Map<string,string>;
 evidence:{truncated:boolean;sufficient:boolean;stale:boolean};
 cfg:{minConfidence:number;ciRequired:boolean;minShare:number};
}
export type PolicyDecision={kind:'pay';allocation:Allocation;reason:string}|{kind:'review';reason:string;suggested?:Allocation};
export function decide(input:PolicyInput):PolicyDecision {
 const review=(reason:string):PolicyDecision=>({kind:'review',reason});
 const {evidence,cfg}=input;
 if(evidence.stale)return review('Evidence is stale');
 if(evidence.truncated)return review('Evidence is truncated');
 if(!evidence.sufficient)return review('Evidence is insufficient');
 if(input.ci==='fail')return review('CI failing');
 if(cfg.ciRequired&&input.ci!=='pass')return review('CI not passing');
 if(![cfg.minConfidence,cfg.minShare].every(n=>Number.isFinite(n)&&n>=0&&n<=1))return review('Invalid funded policy');
 const parsed=verdictSchema.safeParse(input.verdict);
 if(!parsed.success)return review('Invalid verifier output');
 const verdict=parsed.data;
 if(verdict.splits.some(row=>!input.eligible.has(row.gh_id)))return review('Unverified recipient');
 let allocation:Allocation;
 try {
  // Validate even discarded shares: invalid model output cannot be silently repaired.
  for(const row of verdict.splits)integerWeight(row.share);
  const weights=verdict.splits.filter(row=>row.share>=cfg.minShare&&row.share>0).map(row=>({ghId:row.gh_id,login:input.eligible.get(row.gh_id)??'',share:row.share}));
  if(!weights.length)return review('No eligible authors');
  allocation=allocate(input.bountyCents,weights);
 }catch{return review('Invalid allocation');}
 if(verdict.verdict==='RESOLVES'&&verdict.confidence>=cfg.minConfidence)return {kind:'pay',allocation,reason:'Complete solution with sufficient confidence and current evidence'};
 return {kind:'review',reason:'Solution requires maintainer review',suggested:allocation};
}
