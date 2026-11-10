import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { ComputeBudgetProgram,Connection,Keypair,Message,PublicKey,Transaction,TransactionInstruction } from '@solana/web3.js';
import { TOKEN_2022_PROGRAM_ID,getAssociatedTokenAddressSync,createAssociatedTokenAccountIdempotentInstruction,createTransferCheckedInstruction,getMint,getTransferFeeConfig,getTransferHook } from '@solana/spl-token';
import bs58 from 'bs58';
import type { FundingEnv } from '../env.js';
import { atomicAmount,DEVNET_GENESIS,DEVNET_RPC,enabled,PYUSD_MINT,publicWallet } from './config.js';
export interface Transfer {from:string;to:string;amount:number;reference:string}
export interface Prepared {message:string;wire:string;signature:string|null;lastValidBlockHeight:number}
export type Observation='pending'|'success'|'failed'|'unknown';
export interface ChainProvider {
 treasury:()=>Promise<string>;
 prepare:(input:Transfer,sign:boolean)=>Promise<Prepared>;
 accept:(message:string,wire:string)=>{wire:string;signature:string};
 validPreparation:(wire:string)=>Promise<boolean>;
 expiredUnfunded?:(wire:string,input:Transfer,lastValidBlockHeight:number)=>Promise<{slot:number;height:number}|null>;
 publish:(wire:string)=>Promise<void>;
 observe:(wire:string,input:Transfer)=>Promise<Observation>;
 recover?:(input:Transfer,message:string)=>Promise<{wire:string;signature:string}|null>;
}
const mint=new PublicKey(PYUSD_MINT);
const referenceKey=(reference:string)=>new PublicKey(createHash('sha256').update(reference).digest());
const memo=new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
// The reference belongs on the token instruction: Memo requires every supplied
// account to sign. Put the memo immediately before TransferChecked so accounts
// requiring incoming memos are supported too.
export function transferTransaction(input:Transfer,payer:PublicKey,latest:{blockhash:string;lastValidBlockHeight:number}):Transaction {
 const from=new PublicKey(publicWallet(input.from)),to=new PublicKey(publicWallet(input.to));
 if(from.equals(to)||input.reference.length>160)throw new Error('Invalid transfer');
 const source=getAssociatedTokenAddressSync(mint,from,false,TOKEN_2022_PROGRAM_ID),destination=getAssociatedTokenAddressSync(mint,to,false,TOKEN_2022_PROGRAM_ID);
 const instruction=createTransferCheckedInstruction(source,mint,destination,from,atomicAmount(input.amount),6,[],TOKEN_2022_PROGRAM_ID);
 instruction.keys.push({pubkey:referenceKey(input.reference),isSigner:false,isWritable:false});
 return new Transaction({feePayer:payer,...latest}).add(
  // Solflare replaces a zero price with 100000 micro-lamports on devnet.
  // Include that observed fee before signing: 200000 units => 20000 lamports.
  // Any further wallet edit remains rejected by exact-message validation.
  ComputeBudgetProgram.setComputeUnitLimit({units:200000}),
  ComputeBudgetProgram.setComputeUnitPrice({microLamports:100000}),
  createAssociatedTokenAccountIdempotentInstruction(payer,destination,to,mint,TOKEN_2022_PROGRAM_ID),
  new TransactionInstruction({programId:memo,keys:[],data:Buffer.from(input.reference)}),
  instruction,
 );
}
export function acceptSigned(message:string,wire:string):{wire:string;signature:string} {
 if(wire.length>2200)throw new Error('Transaction too large');
 const tx=Transaction.from(Buffer.from(wire,'base64'));
 if(tx.serializeMessage().toString('base64')!==message||!tx.verifySignatures()||!tx.signature)throw new Error('Wallet signed a different transaction');
 const canonical=tx.serialize().toString('base64');
 if(canonical!==wire)throw new Error('Noncanonical transaction');
 return {wire:canonical,signature:bs58.encode(tx.signature)};
}
export function createChainProvider(env:FundingEnv):ChainProvider {
 const connection=new Connection(DEVNET_RPC,{commitment:'finalized',disableRetryOnRateLimit:true,fetch:async(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(15000)})});
 let signerPromise:Promise<Keypair>|undefined;
 async function signer(){enabled(env);signerPromise??=(async()=>{const json:unknown=JSON.parse(await readFile(env.PYUSD_TREASURY_KEY_FILE,'utf8'));if(!Array.isArray(json)||json.length!==64||!json.every(x=>Number.isInteger(x)&&x>=0&&x<=255))throw new Error('Invalid devnet treasury key');return Keypair.fromSecretKey(Uint8Array.from(json as number[]));})();return signerPromise;}
 async function network(){enabled(env);if(await connection.getGenesisHash()!==DEVNET_GENESIS)throw new Error('Refusing non-devnet RPC');}
 async function mintReady(){await network();const info=await getMint(connection,mint,'finalized',TOKEN_2022_PROGRAM_ID);if(info.decimals!==6||!info.isInitialized)throw new Error('Unexpected PYUSD mint');const fee=getTransferFeeConfig(info),hook=getTransferHook(info);if(fee&&(fee.olderTransferFee.transferFeeBasisPoints!==0||fee.newerTransferFee.transferFeeBasisPoints!==0))throw new Error('PYUSD transfer fees require review');if(hook&&!hook.programId.equals(PublicKey.default))throw new Error('PYUSD transfer hooks require review');}
 return {
  async treasury(){return (await signer()).publicKey.toBase58();},
  async prepare(input,sign){
   await mintReady();const treasury=await signer(),from=new PublicKey(publicWallet(input.from)),to=new PublicKey(publicWallet(input.to));
   if(from.equals(to)||input.reference.length>160)throw new Error('Invalid transfer');
   if(sign&&!from.equals(treasury.publicKey))throw new Error('Treasury source required');
   if(!sign&&!to.equals(treasury.publicKey))throw new Error('Treasury destination required');
   const payer=sign?treasury.publicKey:from;
   const latest=await connection.getLatestBlockhash('finalized');
   const tx=transferTransaction(input,payer,latest);
   if(sign)tx.sign(treasury);
   return {message:tx.serializeMessage().toString('base64'),wire:tx.serialize({requireAllSignatures:sign,verifySignatures:sign}).toString('base64'),signature:tx.signature?bs58.encode(tx.signature):null,lastValidBlockHeight:latest.lastValidBlockHeight};
  },
  accept:acceptSigned,
  async validPreparation(wire){
   await network();const tx=Transaction.from(Buffer.from(wire,'base64'));
   if(!tx.recentBlockhash)return false;
   return (await connection.isBlockhashValid(tx.recentBlockhash,{commitment:'finalized'})).value;
  },
  async expiredUnfunded(wire,input,lastValidBlockHeight){
   await network();const tx=Transaction.from(Buffer.from(wire,'base64'));
   if(!tx.recentBlockhash||tx.signatures.some(s=>s.signature!==null))return null;
   const slot=await connection.getSlot('finalized');
   const height=await connection.getBlockHeight({commitment:'finalized',minContextSlot:slot});
   if(height<=lastValidBlockHeight||(await connection.isBlockhashValid(tx.recentBlockhash,{commitment:'finalized',minContextSlot:slot})).value)return null;
   // Any reference activity, including a failed transaction, requires investigation.
   const history=await connection.getSignaturesForAddress(referenceKey(input.reference),{limit:1,minContextSlot:slot},'finalized');
   return history.length===0?{slot,height}:null;
  },
  async recover(input,message){
   await network();const signatures=await connection.getSignaturesForAddress(referenceKey(input.reference),{limit:10},'finalized');
   for(const signature of signatures){if(signature.err)continue;const receipt=await connection.getTransaction(signature.signature,{commitment:'finalized',maxSupportedTransactionVersion:0});
    if(!receipt||!(receipt.transaction.message instanceof Message)||receipt.meta?.err||Buffer.from(receipt.transaction.message.serialize()).toString('base64')!==message)continue;
    // Only legacy transactions are produced by prepare(). A matching signed message can
    // be recovered after the browser closed before reporting it to the application.
    const tx=Transaction.populate(receipt.transaction.message,receipt.transaction.signatures);
    return acceptSigned(message,tx.serialize().toString('base64'));
   }return null;
  },
  async publish(wire){await network();const bytes=Buffer.from(wire,'base64'),tx=Transaction.from(bytes);if(!tx.verifySignatures()||!tx.signature)throw new Error('Unsigned transaction');const id=await connection.sendRawTransaction(bytes,{skipPreflight:false,maxRetries:0,preflightCommitment:'finalized'});if(id!==bs58.encode(tx.signature))throw new Error('Signature mismatch');},
  async observe(wire,input){
   await network();const tx=Transaction.from(Buffer.from(wire,'base64'));if(!tx.signature||!tx.verifySignatures())throw new Error('Invalid persisted transaction');
   const signature=bs58.encode(tx.signature),receipt=await connection.getTransaction(signature,{commitment:'finalized',maxSupportedTransactionVersion:0});
   if(!receipt){const [status]=(await connection.getSignatureStatuses([signature],{searchTransactionHistory:true})).value;if(status?.confirmationStatus==='finalized'&&status.err)return 'failed';if(!status&&tx.recentBlockhash&&!(await connection.isBlockhashValid(tx.recentBlockhash,{commitment:'finalized'})).value)return 'unknown';return 'pending';}
   if(!receipt.meta)return 'unknown';if(receipt.meta.err)return 'failed';
   if(Buffer.from(receipt.transaction.message.serialize()).toString('base64')!==tx.serializeMessage().toString('base64'))return 'unknown';
   const pre=receipt.meta.preTokenBalances??[],post=receipt.meta.postTokenBalances??[];
   return receipt.transaction.signatures[0]===signature&&transferBalancesMatch({preTokenBalances:pre,postTokenBalances:post},input)?'success':'unknown';
  },
 };
}

interface Balance {mint:string;owner?:string;programId?:string;uiTokenAmount:{amount:string;decimals:number}}
export function transferBalancesMatch(meta:{preTokenBalances:Balance[];postTokenBalances:Balance[]},input:Transfer):boolean {
 try {
  const relevant=[...meta.preTokenBalances,...meta.postTokenBalances].filter(r=>r.mint===PYUSD_MINT&&(r.owner===input.from||r.owner===input.to));
  if(relevant.some(r=>r.uiTokenAmount.decimals!==6||r.programId!==TOKEN_2022_PROGRAM_ID.toBase58()||!/^\d+$/.test(r.uiTokenAmount.amount)))return false;
  const amount=(rows:Balance[],owner:string)=>rows.filter(r=>r.mint===PYUSD_MINT&&r.owner===owner).reduce((n,r)=>n+BigInt(r.uiTokenAmount.amount),0n);
  return input.from!==input.to&&amount(meta.postTokenBalances,input.to)-amount(meta.preTokenBalances,input.to)===atomicAmount(input.amount)&&amount(meta.preTokenBalances,input.from)-amount(meta.postTokenBalances,input.from)===atomicAmount(input.amount);
 }catch{return false;}
}
