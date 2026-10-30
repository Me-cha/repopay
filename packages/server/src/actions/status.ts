import { and, eq, desc } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { bounties } from '../db/schema.js';
export async function bountyStatus(db:Database,repoId:string,issueNumber:number) {
 return (await db.orm.select().from(bounties).where(and(eq(bounties.repoId,repoId),eq(bounties.issueNumber,issueNumber))).orderBy(desc(bounties.id)).limit(1))[0];
}

export function awardStatusText(status:string,publicUrl:string):string|undefined {
 if(status==='NEEDS_REVIEW')return 'The earliest merged submission needs review. No award or payment has been authorized.';
 if(status==='AWAITING_CLAIM')return `An award is committed. Every awarded contributor must [connect payout details](${new URL('/connect',publicUrl).href}) before payment can begin. The award stays reserved; missing details do not permit a refund.`;
 if(status==='PAYING')return 'The award is committed. Payment delivery is pending or requires investigation. Do not send a replacement payment; the original award remains reserved.';
 if(status==='PAID')return 'All awarded payout items are currently confirmed delivered. Later returns remain subject to reconciliation and do not cancel the award.';
 return undefined;
}
