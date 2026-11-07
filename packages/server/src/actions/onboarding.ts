import { eq } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { userOnboarding } from '../db/schema.js';
import type { Session } from '../github/oauth.js';
import { assertSession } from './guards.js';
export async function hasSeenDashboardTour(db:Database,ghId:string):Promise<boolean> {
 const [row]=await db.orm.select({ghId:userOnboarding.ghId}).from(userOnboarding).where(eq(userOnboarding.ghId,ghId));
 return Boolean(row);
}
export async function claimDashboardTour(db:Database,session:Session,now:Date):Promise<boolean> {
 return db.withTransaction(async tx=>{
  await assertSession(tx,session,now);
  const inserted=await tx.insert(userOnboarding).values({ghId:session.ghId,dashboardTourSeenAt:now}).onConflictDoNothing().returning({ghId:userOnboarding.ghId});
  return inserted.length===1;
 });
}
