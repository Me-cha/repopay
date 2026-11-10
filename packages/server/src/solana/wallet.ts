import { randomUUID,createPublicKey,verify } from 'node:crypto';
import bs58 from 'bs58';
import { eq,sql } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { chainWallets,chainChallenges } from '../db/schema.js';
import type { Session } from '../github/oauth.js';
import { AuthError } from '../github/oauth.js';
import { assertSession } from '../actions/guards.js';
import { publicWallet } from './config.js';
export function verifyWallet(message:string,address:string,signature:string):boolean {
 try {publicWallet(address);const sig=bs58.decode(signature);if(sig.length!==64)return false;
  const key=createPublicKey({key:Buffer.concat([Buffer.from('302a300506032b6570032100','hex'),Buffer.from(bs58.decode(address))]),format:'der',type:'spki'});
  return verify(null,Buffer.from(message),key,Buffer.from(sig));
 }catch{return false;}
}
export function walletService(db:Database,origin:string,now=()=>new Date()) {
 return {
  async get(ghId:string){return (await db.orm.select().from(chainWallets).where(eq(chainWallets.ghId,ghId)))[0];},
  async challenge(session:Session,address:string){
   try{publicWallet(address);}catch{throw new AuthError(400,'Select a Solana signing wallet.');}
   const id=randomUUID(),expiresAt=new Date(now().getTime()+300000);
   const message=`Repopay wallet connection\nOrigin: ${new URL(origin).origin}\nGitHub ID: ${session.ghId}\nWallet: ${address}\nNetwork: solana-devnet\nNonce: ${id}\nExpires: ${expiresAt.toISOString()}\nThis signature saves a payout wallet. It does not transfer funds.`;
   await db.withTransaction(async tx=>{await assertSession(tx,session,now());await tx.insert(chainChallenges).values({id,sessionId:session.id,ghId:session.ghId,address,message,expiresAt});});
   return {id,message};
  },
  async confirm(session:Session,id:string,signature:string){
   return db.withTransaction(async tx=>{await assertSession(tx,session,now());const [challenge]=await tx.select().from(chainChallenges).where(eq(chainChallenges.id,id)).for('update');
    if(!challenge||challenge.sessionId!==session.id||challenge.ghId!==session.ghId||challenge.usedAt||challenge.expiresAt<=now()||!verifyWallet(challenge.message,challenge.address,signature))throw new AuthError(403,'Wallet proof expired, used, or invalid. Reconnect your wallet.');
    await tx.update(chainChallenges).set({usedAt:now()}).where(eq(chainChallenges.id,id));
    const [saved]=await tx.insert(chainWallets).values({ghId:session.ghId,address:challenge.address}).onConflictDoUpdate({target:chainWallets.ghId,set:{address:challenge.address,version:sql`${chainWallets.version}+1`,updatedAt:now()}}).returning();return saved;
   });
  },
 };
}
