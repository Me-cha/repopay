import { and, eq, ne } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { bounties } from '../db/schema.js';
export async function bountyStatus(db:Database,repoId:string,issueNumber:number) {
 return (await db.orm.select().from(bounties).where(and(eq(bounties.repoId,repoId),eq(bounties.issueNumber,issueNumber),ne(bounties.status,'CANCELLED'))))[0];
}
