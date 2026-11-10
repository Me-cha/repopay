import { eq } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { awards,payoutItems,chainTransfers,type Bounty } from '../db/schema.js';
import type { PayoutDto } from './contracts.js';
export async function payoutRows(db:Database,b:Bounty):Promise<PayoutDto[]>{const [award]=await db.orm.select().from(awards).where(eq(awards.bountyId,b.id));if(!award)return [];
 const items=await db.orm.select({ghId:payoutItems.ghId,status:payoutItems.status}).from(payoutItems).where(eq(payoutItems.awardId,award.id));
 const chainItems=b.currency==='PYUSD'?await db.orm.select({ghId:chainTransfers.ghId,status:chainTransfers.status}).from(chainTransfers).where(eq(chainTransfers.awardId,award.id)):[];
 return award.allocation.map(a=>{const item=[...items,...chainItems].find(i=>i.ghId===a.ghId),status=item?.status??'AWAITING_CLAIM',githubUrl=`https://github.com/${b.repoFullName}/issues/${String(b.issueNumber)}`;return {currency:b.currency==='PYUSD'?'PYUSD':'USD',id:award.id+':'+a.ghId,bountyId:b.id,repoFullName:b.repoFullName,issueNumber:b.issueNumber,ghId:a.ghId,login:a.login,amountCents:a.cents,paidCents:status==='SUCCESS'?a.cents:0,status,githubUrl,nextAction:status==='AWAITING_CLAIM'?{actor:'Awarded contributors',label:'Connect payout details',href:b.currency==='PYUSD'?'/dashboard/wallet':'/connect'}:status==='SUCCESS'?{actor:'Contributor',label:'Payment delivered; view award',href:githubUrl}:{actor:'Payment service / operator',label:'Reconcile the existing transfer; award remains committed',href:githubUrl}};});
}
