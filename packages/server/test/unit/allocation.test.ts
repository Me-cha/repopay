import { expect,it } from 'vitest';
import { allocate } from '../../src/policy/allocate.js';
const weight=(ghId:string,share:number)=>({ghId,login:`user${ghId}`,share});
it('allocates exact cents with byte-order ties, independent of input order',()=>{
 const weights=[weight('2',1),weight('10',1),weight('3',1)];
 expect(allocate(1,weights)).toEqual([{ghId:'10',login:'user10',cents:1}]);
 expect(allocate(17,weights)).toEqual(allocate(17,[...weights].reverse()));
 for(let total=1;total<300;total++)expect(allocate(total,weights).reduce((sum,row)=>sum+row.cents,0)).toBe(total);
 expect(allocate(2147483647,weights).reduce((sum,row)=>sum+row.cents,0)).toBe(2147483647);
});
it('rejects invalid totals, duplicate identities and invalid precision without rounding',()=>{
 for(const total of [0,-1,1.5,NaN,Infinity,2147483648])expect(()=>allocate(total,[weight('1',1)])).toThrow();
 for(const share of [NaN,Infinity,-1,0.0000001,1.0000001])expect(()=>allocate(10,[weight('1',share)])).toThrow();
 expect(()=>allocate(10,[weight('1',1),weight('1',2)])).toThrow();
 expect(()=>allocate(10,[weight('01',1)])).toThrow();
 expect(()=>allocate(10,[])).toThrow();
 expect(()=>allocate(10,[weight('1',0)])).toThrow();
 expect(allocate(10,[weight('1',0),weight('2',0.000001)])).toEqual([{ghId:'2',login:'user2',cents:10}]);
});
it('preserves sums across generated integer weights and permutations',()=>{
 let seed=17;const next=()=>{seed=(seed*48271)%2147483647;return seed;};
 for(let i=0;i<300;i++){
  const weights=Array.from({length:1+next()%10},(_,j)=>weight(String(j+1),(1+next()%1000000)/1000000));
  const total=1+next()%2147483647,result=allocate(total,weights);
  expect(result.reduce((sum,row)=>sum+row.cents,0)).toBe(total);
  expect(result.every(row=>Number.isInteger(row.cents)&&row.cents>0)).toBe(true);
  expect(result).toEqual(allocate(total,[...weights].reverse()));
 }
});
