import { expect,it,vi } from 'vitest';
import { ComputeBudgetInstruction,ComputeBudgetProgram,Connection,Keypair,PublicKey,Transaction,SystemProgram } from '@solana/web3.js';
import { acceptSigned,createChainProvider,transferTransaction } from '../../src/solana/provider.js';
import { fundingEnv } from '../helpers/funding.js';
import { atomicAmount,DEVNET_GENESIS,publicWallet } from '../../src/solana/config.js';
it('pins the complete 32-byte devnet genesis hash',()=>{
 expect(new PublicKey(DEVNET_GENESIS).toBytes()).toHaveLength(32);
 expect(DEVNET_GENESIS).toBe('EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG');
});
it('refuses a non-devnet genesis before broadcasting even a valid signed transaction',async()=>{
 const genesis=vi.spyOn(Connection.prototype,'getGenesisHash').mockResolvedValue('wrong-network'),send=vi.spyOn(Connection.prototype,'sendRawTransaction').mockRejectedValue(new Error('must not send'));
 try{const env=fundingEnv();env.PYUSD_DEVNET_ENABLED=true;env.PYUSD_TREASURY_KEY_FILE='unused-local-key';
  const signer=Keypair.generate(),tx=transferTransaction({from:signer.publicKey.toBase58(),to:Keypair.generate().publicKey.toBase58(),amount:100,reference:'network-test'},signer.publicKey,{blockhash:Keypair.generate().publicKey.toBase58(),lastValidBlockHeight:100});tx.sign(signer);
  await expect(createChainProvider(env).publish(tx.serialize().toString('base64'))).rejects.toThrow('non-devnet');expect(send).not.toHaveBeenCalled();
 }finally{genesis.mockRestore();send.mockRestore();}
});
it('builds a signable Token-2022 transfer with a discoverable nonsigner reference and a valid preceding memo',async()=>{
 const {TOKEN_2022_PROGRAM_ID,decodeTransferCheckedInstruction}=await import('@solana/spl-token');
 const from=Keypair.generate(),to=Keypair.generate(),tx=transferTransaction({from:from.publicKey.toBase58(),to:to.publicKey.toBase58(),amount:50,reference:'repopay:test'},from.publicKey,{blockhash:Keypair.generate().publicKey.toBase58(),lastValidBlockHeight:100});
 const memo=tx.instructions[3],instruction=tx.instructions[4];if(!memo||!instruction)throw new Error('Missing payment instructions');
 expect(memo.programId.toBase58()).toBe('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');expect(memo.keys.every(k=>k.isSigner)).toBe(true);
 const decoded=decodeTransferCheckedInstruction(instruction,TOKEN_2022_PROGRAM_ID);expect(decoded.data).toMatchObject({amount:500000n,decimals:6});expect(instruction.keys.at(-1)).toMatchObject({isSigner:false,isWritable:false});
 tx.sign(from);expect(tx.verifySignatures()).toBe(true);expect(tx.compileMessage().header.numRequiredSignatures).toBe(1);
});
it('pins wallet fee settings and preserves the exact prepared message through wallet serialization',()=>{
 const signer=Keypair.generate(),tx=transferTransaction({from:signer.publicKey.toBase58(),to:Keypair.generate().publicKey.toBase58(),amount:100,reference:'wallet-roundtrip'},signer.publicKey,{blockhash:Keypair.generate().publicKey.toBase58(),lastValidBlockHeight:100});
 const budget=tx.instructions.filter(i=>i.programId.equals(ComputeBudgetProgram.programId));expect(budget).toHaveLength(2);
 const [limit,price]=budget;if(!limit||!price)throw new Error('Missing fee settings');
 expect(ComputeBudgetInstruction.decodeSetComputeUnitLimit(limit)).toEqual({units:200000});expect(ComputeBudgetInstruction.decodeSetComputeUnitPrice(price)).toEqual({microLamports:100000n});
 const message=tx.serializeMessage().toString('base64'),walletTx=Transaction.from(tx.serialize({requireAllSignatures:false,verifySignatures:false}));walletTx.sign(signer);
 expect(acceptSigned(message,walletTx.serialize().toString('base64')).signature).toBeTruthy();
 walletTx.instructions.unshift(ComputeBudgetProgram.setComputeUnitPrice({microLamports:1000}));walletTx.sign(signer);
 expect(()=>acceptSigned(message,walletTx.serialize().toString('base64'))).toThrow('different transaction');
});
it('PYUSD uses exact integer conversion and rejects invalid amounts',()=>{expect(atomicAmount(1)).toBe(10000n);expect(atomicAmount(5000)).toBe(50000000n);for(const amount of [0,-1,1.1,Infinity,NaN,2147483648])expect(()=>atomicAmount(amount)).toThrow();});
it('rejects malformed wallet addresses and off-curve recipients',()=>{expect(()=>publicWallet('fake')).toThrow();expect(publicWallet(Keypair.generate().publicKey.toBase58())).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);});
it('signed transaction must match all prepared bytes, not merely a destination or supplied signature',()=>{const signer=Keypair.generate(),to=Keypair.generate().publicKey;const tx=new Transaction({feePayer:signer.publicKey,blockhash:Keypair.generate().publicKey.toBase58(),lastValidBlockHeight:100}).add(SystemProgram.transfer({fromPubkey:signer.publicKey,toPubkey:to,lamports:1}));const message=tx.serializeMessage().toString('base64');expect(()=>acceptSigned(message,tx.serialize({requireAllSignatures:false,verifySignatures:false}).toString('base64'))).toThrow();tx.sign(signer);expect(acceptSigned(message,tx.serialize().toString('base64')).signature).toBeTruthy();tx.recentBlockhash=Keypair.generate().publicKey.toBase58();tx.sign(signer);expect(()=>acceptSigned(message,tx.serialize().toString('base64'))).toThrow();});
it('chain receipts require the correct mint, token program, owners and exact debit/credit without transfer fees',async()=>{
 const {transferBalancesMatch}=await import('../../src/solana/provider.js'),{PYUSD_MINT}=await import('../../src/solana/config.js'),{TOKEN_2022_PROGRAM_ID}=await import('@solana/spl-token');
 const balance=(owner:string,amount:string)=>({owner,mint:PYUSD_MINT,programId:TOKEN_2022_PROGRAM_ID.toBase58(),uiTokenAmount:{amount,decimals:6}});
 const input={from:'funder',to:'treasury',amount:100,reference:'test'},good={preTokenBalances:[balance('funder','2000000')],postTokenBalances:[balance('funder','1000000'),balance('treasury','1000000')]};expect(transferBalancesMatch(good,input)).toBe(true);
 for(const bad of [
  {...good,postTokenBalances:[balance('funder','1000000'),balance('someone-else','1000000')]},
  {...good,postTokenBalances:[balance('funder','1000000'),balance('treasury','999999')]},
  {...good,postTokenBalances:[balance('funder','1000001'),balance('treasury','1000000')]},
  {...good,postTokenBalances:good.postTokenBalances.map(r=>({...r,mint:'wrong'}))},
  {...good,postTokenBalances:good.postTokenBalances.map(r=>({...r,programId:'wrong'}))},
  {...good,postTokenBalances:good.postTokenBalances.map(r=>({...r,uiTokenAmount:{...r.uiTokenAmount,decimals:9}}))},
 ])expect(transferBalancesMatch(bad,input)).toBe(false);
});

it('expired funding proof requires finalized expiry and no reference activity; RPC failure never proves absence',async()=>{
 let height=101,valid=false,activity=false,unavailable=false;
 const calls:{method:string;params:unknown[]}[]=[];
 const fetcher=vi.spyOn(globalThis,'fetch').mockImplementation((_url,init)=>{
  if(typeof init?.body!=='string')throw new Error('Expected JSON body');
  const body=JSON.parse(init.body) as {id:string;method:string;params:unknown[]};calls.push(body);
  if(unavailable&&body.method==='getSignaturesForAddress')return Promise.reject(new Error('RPC unavailable'));
  const result=body.method==='getGenesisHash'?DEVNET_GENESIS:body.method==='getSlot'?200:body.method==='getBlockHeight'?height:body.method==='isBlockhashValid'?{context:{slot:200},value:valid}:activity?[{signature:'activity',slot:199,err:null,memo:null}]:[];
  return Promise.resolve(new Response(JSON.stringify({jsonrpc:'2.0',id:body.id,result}),{status:200}));
 });
 try{
  const env=fundingEnv();env.PYUSD_DEVNET_ENABLED=true;env.PYUSD_TREASURY_KEY_FILE='unused';const provider=createChainProvider(env),key=Keypair.generate();
  const input={from:key.publicKey.toBase58(),to:Keypair.generate().publicKey.toBase58(),amount:100,reference:'expiry-proof'};
  const tx=transferTransaction(input,key.publicKey,{blockhash:Keypair.generate().publicKey.toBase58(),lastValidBlockHeight:100}),wire=tx.serialize({requireAllSignatures:false,verifySignatures:false}).toString('base64');
  expect(await provider.expiredUnfunded?.(wire,input,100)).toEqual({slot:200,height:101});
  expect(calls.find(c=>c.method==='getSignaturesForAddress')?.params[1]).toEqual({limit:1,minContextSlot:200,commitment:'finalized'});
  height=100;expect(await provider.expiredUnfunded?.(wire,input,100)).toBeNull();height=101;
  valid=true;expect(await provider.expiredUnfunded?.(wire,input,100)).toBeNull();valid=false;
  activity=true;expect(await provider.expiredUnfunded?.(wire,input,100)).toBeNull();
  unavailable=true;await expect(provider.expiredUnfunded?.(wire,input,100)).rejects.toThrow('RPC unavailable');
  tx.sign(key);expect(await provider.expiredUnfunded?.(tx.serialize().toString('base64'),input,100)).toBeNull();
 }finally{fetcher.mockRestore();}
});
