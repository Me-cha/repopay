import { cents,githubId } from '../domain/types.js';

export interface AuthorWeight { ghId:string; login:string; share:number }
export type Allocation = { ghId:string; login:string; cents:number }[];

// Parse the shortest decimal representation, never round a model-provided share.
// Six fractional digits become integer millionths before any allocation arithmetic.
export function integerWeight(share:number):bigint {
 if(!Number.isFinite(share)||share<0)throw new Error('Invalid author weight');
 const decimal=String(share);
 if(!/^\d+(?:\.\d{1,6})?$/.test(decimal))throw new Error('Author weight exceeds six-decimal precision');
 const [whole,fraction='']=decimal.split('.');
 return BigInt(whole??'0')*1000000n+BigInt(fraction.padEnd(6,'0'));
}
export function allocate(total:number,weights:AuthorWeight[]):Allocation {
 cents(total);if(total===0)throw new Error('Allocation requires positive cents');
 const seen=new Set<string>();
 const rows=weights.map(row=>{
  githubId(row.ghId);
  if(seen.has(row.ghId))throw new Error('Duplicate author');seen.add(row.ghId);
  return {...row,weight:integerWeight(row.share),amount:0n,remainder:0n};
 });
 const sum=rows.reduce((value,row)=>value+row.weight,0n);
 if(sum<=0n)throw new Error('No positive author weights');
 for(const row of rows){const numerator=BigInt(total)*row.weight;row.amount=numerator/sum;row.remainder=numerator%sum;}
 let remaining=BigInt(total)-rows.reduce((value,row)=>value+row.amount,0n);
 const compareId=(a:{ghId:string},b:{ghId:string})=>a.ghId<b.ghId?-1:a.ghId>b.ghId?1:0;
 rows.sort((a,b)=>a.remainder>b.remainder?-1:a.remainder<b.remainder?1:compareId(a,b));
 for(const row of rows){if(remaining===0n)break;row.amount++;remaining--;}
 const result=rows.filter(row=>row.amount>0n).sort(compareId).map(row=>({ghId:row.ghId,login:row.login,cents:cents(Number(row.amount))}));
 if(remaining!==0n||result.reduce((value,row)=>value+row.cents,0)!==total)throw new Error('Allocation invariant failed');
 return result;
}
