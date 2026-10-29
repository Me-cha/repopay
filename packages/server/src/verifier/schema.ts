import { z } from 'zod';

export const verdictSchema=z.object({
 verdict:z.enum(['RESOLVES','PARTIAL','DOES_NOT_RESOLVE']),
 coverage:z.number().min(0).max(1),confidence:z.number().min(0).max(1),
 reasoning:z.string().trim().min(1).max(2000),unmet_requirements:z.array(z.string().trim().min(1).max(300)).max(10),
 splits:z.array(z.object({gh_id:z.string().regex(/^[1-9]\d*$/),share:z.number().min(0).max(1),why:z.string().max(300)}).strict()).max(10),
}).strict().superRefine((value,ctx)=>{
 const ids=new Set<string>();let total=0;
 for(const item of value.splits){if(ids.has(item.gh_id))ctx.addIssue({code:'custom',path:['splits'],message:'duplicate author'});ids.add(item.gh_id);total+=item.share;}
 if(value.splits.length&&Math.abs(total-1)>0.000001)ctx.addIssue({code:'custom',path:['splits'],message:'shares must sum to one'});
});
export type Verdict=z.infer<typeof verdictSchema>;
export function validateVerdictForAuthors(value:Verdict,authors:{ghId:string;login:string}[]):Verdict {
 const allowed=new Set(authors.map(author=>author.ghId));if(value.splits.some(item=>!allowed.has(item.gh_id)))throw new Error('Verifier returned an unknown author');return value;
}
