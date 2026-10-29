import { eq,sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '../db/client.js';
import type { Session } from '../github/oauth.js';
import { AuthError } from '../github/oauth.js';
import { contributors } from '../db/schema.js';
import { decrypt, encrypt } from '../util/crypto.js';
import { enqueue } from '../jobs/queue.js';

const emailSchema=z.email().trim().max(254);
const context=(ghId:string)=>`contributor:${ghId}:paypal-email:v1`;
export interface ContributorConnection {ghId:string;ghLogin:string;maskedEmail:string;connectionVersion:number}
export function maskEmail(value:string):string {
 const at=value.lastIndexOf('@');if(at<1)return '••••';const local=value.slice(0,at),domain=value.slice(at+1),dot=domain.lastIndexOf('.');
 const host=dot>0?domain.slice(0,dot):domain,suffix=dot>0?domain.slice(dot):'';
 return `${local.slice(0,1)}•••@${host.slice(0,1)}•••${suffix}`;
}
export async function getContributorConnection(db:Database,ghId:string,key:string):Promise<ContributorConnection|undefined> {
 const [row]=await db.orm.select().from(contributors).where(eq(contributors.ghId,ghId));if(!row)return;
 return {ghId:row.ghId,ghLogin:row.ghLogin,maskedEmail:maskEmail(decrypt(row.paypalEmailEnc,key,context(ghId))),connectionVersion:row.connectionVersion};
}
export async function connectContributor(db:Database,session:Session,input:{paypalEmail:unknown},key:string,now=()=>new Date()):Promise<ContributorConnection> {
 const parsed=emailSchema.safeParse(input.paypalEmail);if(!parsed.success)throw new AuthError(400,'Enter a valid PayPal email address.');const paypalEmail=parsed.data;
 let saved:typeof contributors.$inferSelect|undefined;
 await db.withTransaction(async tx=>{
  const [row]=await tx.insert(contributors).values({ghId:session.ghId,ghLogin:session.ghLogin,paypalEmailEnc:encrypt(paypalEmail,key,context(session.ghId)),connectionVersion:1,updatedAt:now()}).onConflictDoUpdate({target:contributors.ghId,set:{ghLogin:session.ghLogin,paypalEmailEnc:encrypt(paypalEmail,key,context(session.ghId)),connectionVersion:sql`${contributors.connectionVersion}+1`,updatedAt:now()}}).returning();
  if(!row)throw new Error('Contributor connection was not saved');saved=row;
  await enqueue(tx,{kind:'retry_claims',payload:{ghId:session.ghId,connectionVersion:row.connectionVersion},dedupeKey:`claims:${session.ghId}:${String(row.connectionVersion)}`,maxAttempts:5});
 });
 if(!saved)throw new Error('Contributor connection was not saved');
 return {ghId:saved.ghId,ghLogin:saved.ghLogin,maskedEmail:maskEmail(paypalEmail),connectionVersion:saved.connectionVersion};
}
