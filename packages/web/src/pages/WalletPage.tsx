import { useEffect,useState,useRef } from 'react';
import { ComputeBudgetInstruction,ComputeBudgetProgram,Transaction } from '@solana/web3.js';
import bs58 from 'bs58';
import { z } from 'zod';
import { getWallets } from '@wallet-standard/app';
import type { StandardConnectFeature } from '@wallet-standard/features';
import type { SolanaSignTransactionFeature,SolanaSignMessageFeature } from '@solana/wallet-standard-features';
const registeredWallets=getWallets();
const devnet='solana:devnet' as const;
const walletState=z.object({login:z.string(),address:z.string().nullable(),csrfChallenge:z.string(),csrfConfirm:z.string()});
const fundingState=z.object({status:z.string(),amount:z.number(),terms:z.object({title:z.string(),criteria:z.string(),policy:z.object({fundedCancellationEnabled:z.boolean()}),chain:z.object({treasury:z.string(),refundWallet:z.string()})}),hash:z.string().optional(),id:z.string().optional(),wire:z.string().nullable().optional(),signature:z.string().nullable().optional(),transferStatus:z.string().optional(),attention:z.string().nullable().optional(),csrfReserve:z.string().optional(),csrfSign:z.string().optional(),csrfPrepare:z.string().optional()});
type RegisteredWallet=ReturnType<typeof registeredWallets.get>[number];
type Features=Partial<StandardConnectFeature&SolanaSignTransactionFeature&SolanaSignMessageFeature>;
function compatible(provider:RegisteredWallet){
 const features=provider.features as Features;
 return provider.chains.includes(devnet)&&!!features['standard:connect']&&
  (!!features['solana:signMessage']||!!features['solana:signTransaction']?.supportedTransactionVersions.includes('legacy'));
}
async function request(path:string,data?:Record<string,string>):Promise<unknown>{const res=await fetch(path,{credentials:'same-origin',cache:'no-store',...(data?{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(data)}:{})});const result:unknown=await res.json();if(!res.ok)throw new Error(z.object({error:z.string()}).parse(result).error);return result;}
export function changedTransactionDetails(original:Transaction,result:Transaction):string {
 const changes:string[]=[];
 if(original.recentBlockhash!==result.recentBlockhash)changes.push('blockhash changed');
 if(original.feePayer?.toBase58()!==result.feePayer?.toBase58())changes.push('fee payer changed');
 const describe=(tx:Transaction,index:number)=>{
  const i=tx.instructions[index];if(!i)return 'absent';
  if(i.programId.equals(ComputeBudgetProgram.programId)){
   try{const type=ComputeBudgetInstruction.decodeInstructionType(i);
    if(type==='SetComputeUnitPrice')return `compute price ${ComputeBudgetInstruction.decodeSetComputeUnitPrice(i).microLamports.toString()}`;
    if(type==='SetComputeUnitLimit')return `compute limit ${ComputeBudgetInstruction.decodeSetComputeUnitLimit(i).units.toString()}`;
   }catch{/* Keep unknown changes rejected. */}
   return 'compute budget';
  }return `program ${i.programId.toBase58()}`;
 };
 for(let n=0;n<Math.max(original.instructions.length,result.instructions.length);n++){
  const a=original.instructions[n],b=result.instructions[n];
  if(!a||!b||!a.programId.equals(b.programId)||!a.data.equals(b.data)||a.keys.length!==b.keys.length||a.keys.some((k,j)=>!b.keys[j]?.pubkey.equals(k.pubkey)||b.keys[j].isSigner!==k.isSigner||b.keys[j].isWritable!==k.isWritable))changes.push(`instruction ${String(n+1)}: ${describe(original,n)} → ${describe(result,n)}`);
 }
 return changes.length?changes.slice(0,6).join('; '):'message account ordering or header changed';
}
export function WalletPage(){
 const [wallet,setWallet]=useState<z.infer<typeof walletState>|null>(null),[funding,setFunding]=useState<z.infer<typeof fundingState>|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[progress,setProgress]=useState('');
 const stage=useRef('Checkout');
 const [walletName,setWalletName]=useState('');
 const [discovered,setDiscovered]=useState(()=>registeredWallets.get());
 const availableWallets=discovered.filter(compatible);
 useEffect(()=>{
  const update=()=>{setDiscovered(registeredWallets.get());};
  const offRegister=registeredWallets.on('register',update),offUnregister=registeredWallets.on('unregister',update);
  update();return()=>{offRegister();offUnregister();};
 },[]);
 function selectedWallet(){
  const provider=registeredWallets.get().find(w=>compatible(w)&&(!walletName||w.name===walletName));
  if(!provider)throw new Error('No compatible devnet wallet detected. Open or install a Solana Wallet Standard wallet, enable devnet, and select it here.');
  return provider;
 }
 function step(name:string,message:string){stage.current=name;setProgress(message);}
 const bounty=new URLSearchParams(window.location.search).get('funding');
 async function refresh(){const w=walletState.parse(await request('/api/pyusd'));setWallet(w);if(bounty&&w.address)setFunding(fundingState.parse(await request('/api/pyusd/bounties/'+encodeURIComponent(bounty))));}
 useEffect(()=>{let active=true;void refresh().catch((e:unknown)=>{if(active)setError(e instanceof Error?e.message:'Unable to load wallet');});return()=>{active=false;};},[bounty]); // Account-scoped server session; never cached locally.
 async function run(action:()=>Promise<void>){setBusy(true);if(action!==refresh)setError('');step('Checkout','Checking checkout…');try{await action();await refresh();}catch(e){const detail=e instanceof Error?e.message:z.object({message:z.string()}).safeParse(e).data?.message;setError(`${stage.current}: ${detail?.slice(0,700)??'Operation unavailable. Refresh status before retrying.'}`);}finally{setBusy(false);setProgress('');}}
 async function connect(){
  if(!wallet)return;const provider=selectedWallet(),features=provider.features as Features;
  const connector=features['standard:connect'],signer=features['solana:signMessage'];
  if(!connector||!signer)throw new Error('This wallet cannot sign ownership messages. Select a wallet with Solana message-signing support.');
  step('Wallet connection',`Connect ${provider.name} to save your receiving wallet.`);
  const {accounts}=await connector.connect();
  const account=accounts.find(a=>a.chains.includes(devnet)&&a.features.includes('solana:signMessage'));
  if(!account)throw new Error('Select a Solana devnet account that supports message signing.');
  const c=z.object({id:z.string(),message:z.string()}).parse(await request('/api/pyusd/wallet/challenge',{csrf:wallet.csrfChallenge,address:account.address}));
  const message=new TextEncoder().encode(c.message);
  step('Wallet ownership','Approve the ownership message. This does not transfer tokens.');
  const [signed]=await signer.signMessage({account,message});
  if(!signed||signed.signedMessage.length!==message.length||signed.signedMessage.some((byte,index)=>byte!==message[index]))throw new Error('Wallet changed the ownership message. Nothing was saved.');
  await request('/api/pyusd/wallet/confirm',{csrf:wallet.csrfConfirm,id:c.id,signature:bs58.encode(signed.signature)});
 }
 async function fundingSigner(current:z.infer<typeof fundingState>){
  // Legacy injected signTransaction has no chain context. In particular,
  // Solflare can interpret such requests as mainnet even in devnet mode.
  const provider=selectedWallet();
  const features=provider.features as Features;
  const connect=features['standard:connect'],signer=features['solana:signTransaction'];
  if(!connect||!signer||!signer.supportedTransactionVersions.includes('legacy'))throw new Error('This wallet cannot sign the prepared transaction. Select a devnet wallet with Wallet Standard legacy transaction-signing support.');
  step('Wallet connection',`Connect ${provider.name} using the funding wallet. This connection alone does not transfer tokens.`);
  const {accounts}=await connect.connect();
  const account=accounts.find(a=>a.address===current.terms.chain.refundWallet&&a.chains.includes(devnet)&&a.features.includes('solana:signTransaction'));
  if(!account)throw new Error('Select the funding wallet shown below on Solana devnet.');
  return {account,signer};
 }
 async function fund(){
  if(!bounty||!funding?.hash||!funding.csrfReserve)return;
  // Obtain wallet permission before creating a time-limited transaction.
  const connected=await fundingSigner(funding);
  await request('/api/pyusd/bounties/'+bounty,{hash:funding.hash,csrf:funding.csrfReserve});
  const current=fundingState.parse(await request('/api/pyusd/bounties/'+bounty));setFunding(current);
  await sign(current,connected);
 }
 async function sign(current=funding,connected?:Awaited<ReturnType<typeof fundingSigner>>){
  if(!current?.csrfSign||!current.csrfPrepare||!current.id)throw new Error('Refresh the checkout before signing.');
  const {account,signer}=connected??await fundingSigner(current);
  // First preparation happens here, immediately before requesting a signature.
  // Previously prepared messages are validated, never replaced.
  step('Transaction preparation','Checking the previous attempt and preparing the devnet transaction…');
  const prepared=z.object({id:z.string(),wire:z.string(),csrfSign:z.string()}).parse(await request(`/api/pyusd/transfers/${current.id}/prepare`,{csrf:current.csrfPrepare}));
  const transaction=Uint8Array.from(atob(prepared.wire),c=>c.charCodeAt(0));
  step('Wallet signature','Approve the transaction in your wallet on Solana devnet. Keep this page open.');
  const [signed]=await signer.signTransaction({account,transaction,chain:devnet,options:{preflightCommitment:'finalized'}});
  if(!signed)throw new Error('Wallet did not return a signed transaction.');
  step('Wallet response validation','Wallet response received. Checking the signed transaction…');
  const original=Transaction.from(transaction),result=Transaction.from(signed.signedTransaction);
  if(!original.serializeMessage().equals(result.serializeMessage()))throw new Error(`Wallet changed the prepared transaction (${changedTransactionDetails(original,result)}). Nothing was submitted.`);
  const wire=btoa(String.fromCharCode(...result.serialize()));
  step('Signed transaction submission','Saving the signed transaction to Repopay…');
  await request(`/api/pyusd/transfers/${prepared.id}/sign`,{csrf:prepared.csrfSign,wire});
 }
 return <section className="card" style={{maxWidth:800,margin:'24px auto',padding:24}}><h1>PYUSD wallet · Solana devnet</h1><p>Test tokens only. PYUSD funding and rewards stay in PYUSD. PayPal USD payments remain separate.</p>{error&&!funding&&<p role="alert">{error}</p>}{wallet&&<><p>Signed in as <strong>{wallet.login}</strong></p><p>{wallet.address?<>Saved wallet: <code>{wallet.address}</code>. Reused for future rewards. Existing payout destinations stay fixed.</>:'Connect a wallet and sign the ownership message once.'}</p>{availableWallets.length>0&&<label>Signing wallet <select aria-label="Signing wallet" disabled={busy} value={walletName||availableWallets[0]?.name} onChange={e=>{setWalletName(e.target.value);}}>{availableWallets.map(w=><option key={w.name} value={w.name}>{w.name}</option>)}</select></label>}{availableWallets.length===0&&<p>No compatible wallet detected. Open a Solana Wallet Standard wallet with devnet enabled.</p>}<button disabled={busy} onClick={()=>{void run(connect);}}>{wallet.address?'Change saved wallet':'Connect and save wallet'}</button></>}
 {funding&&<div style={{marginTop:24}}><h2>{funding.terms.title}</h2><p><strong>{funding.amount.toFixed(2)} PYUSD</strong> · {funding.status}{funding.transferStatus?' / '+funding.transferStatus:''}</p><pre style={{whiteSpace:'pre-wrap'}}>{funding.terms.criteria}</pre><p>Funds are held by Repopay’s devnet treasury until a qualifying award. {funding.terms.policy.fundedCancellationEnabled?'Funded cancellation requires an independent review after a 72-hour public notice; refunds return only to the original funding wallet.':'Funded cancellation/refunds are unavailable in these terms.'} A rejected or closed PR does not refund funding.</p><p>Funding wallet: <code>{funding.terms.chain.refundWallet}</code></p><p>Treasury: <code>{funding.terms.chain.treasury}</code></p><p>Your wallet pays funding SOL fees and any token-account creation cost. New preparations include a maximum 0.00002 test SOL priority fee; review the total in your wallet. Repopay pays outgoing fees and account creation separately from the reward.</p>{funding.attention&&<p role="status">{funding.attention}</p>}
 {error&&<p role="alert">{error}</p>}
 {busy&&progress&&<p role="status">{progress}</p>}
 {!busy&&!funding.signature&&funding.id&&<p>The transaction has not been received by Repopay. Wallet connection or approval alone does not confirm funding.</p>}
 {funding.hash&&<button disabled={busy} onClick={()=>{void run(fund);}}>Confirm terms and fund with wallet</button>}
 {funding.id&&!funding.signature&&funding.csrfPrepare&&<button disabled={busy} onClick={()=>{void run(()=>sign());}}>Continue funding in wallet</button>}

 {funding.signature&&<p><a href={`https://explorer.solana.com/tx/${funding.signature}?cluster=devnet`} target="_blank" rel="noreferrer">View devnet transaction</a></p>}</div>}
 <p><button disabled={busy} onClick={()=>{void run(refresh);}}>Refresh status</button> · <a href="/dashboard/payouts/settings">PayPal payout settings</a></p></section>;
}
