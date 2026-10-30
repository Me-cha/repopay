import { expect,it } from 'vitest';
import { decide,type PolicyInput } from '../../src/policy/decide.js';
const input=():PolicyInput=>({bountyCents:101,verdict:{verdict:'RESOLVES',coverage:1,confidence:0.95,reasoning:'Complete',unmet_requirements:[],splits:[{gh_id:'1',share:1,why:'author'}]},ci:'pass',eligible:new Map([['1','one']]),evidence:{truncated:false,sufficient:true,stale:false},cfg:{minConfidence:0.9,ciRequired:true,minShare:0.05}});
it('pays only the full fixed bounty to verified eligible IDs',()=>{
 expect(decide(input())).toMatchObject({kind:'pay',allocation:[{ghId:'1',login:'one',cents:101}]});
});
it('fails closed for missing evidence and failing or missing required CI',()=>{
 for(const ci of ['fail','pending','none'] as const)expect(decide({...input(),ci}).kind).toBe('review');
 for(const evidence of [{truncated:true,sufficient:true,stale:false},{truncated:false,sufficient:false,stale:false},{truncated:false,sufficient:true,stale:true}])expect(decide({...input(),evidence})).not.toHaveProperty('allocation');
 expect(decide({...input(),ci:'none',cfg:{...input().cfg,ciRequired:false}}).kind).toBe('pay');
});
it('rejects unknown, duplicate, empty, all-zero and excess-precision recipients',()=>{
 for(const splits of [[],[{gh_id:'2',share:1,why:''}],[{gh_id:'1',share:0.5,why:''},{gh_id:'1',share:0.5,why:''}],[{gh_id:'1',share:0,why:''}],[{gh_id:'1',share:0.9999999,why:''}]]){
  const result=decide({...input(),verdict:{...input().verdict,splits}});expect(result.kind).toBe('review');expect(result).not.toHaveProperty('suggested');
 }
 expect(decide({...input(),eligible:new Map()}).kind).toBe('review');
});
it('suggests the full amount for uncertainty without authorizing it',()=>{
 expect(decide({...input(),verdict:{...input().verdict,verdict:'PARTIAL',coverage:0.2}})).toMatchObject({kind:'review',suggested:[{ghId:'1',login:'one',cents:101}]});
 expect(decide({...input(),verdict:{...input().verdict,confidence:0.1}}).kind).toBe('review');
 expect(decide({...input(),cfg:{...input().cfg,minConfidence:NaN}}).kind).toBe('review');
});
