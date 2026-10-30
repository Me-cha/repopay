import { and, eq, desc } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { bounties } from '../db/schema.js';
export async function bountyStatus(db:Database,repoId:string,issueNumber:number) {
 return (await db.orm.select().from(bounties).where(and(eq(bounties.repoId,repoId),eq(bounties.issueNumber,issueNumber))).orderBy(desc(bounties.id)).limit(1))[0];
}
