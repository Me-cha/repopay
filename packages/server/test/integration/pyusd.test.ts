import { sign,createPrivateKey,randomUUID,createHash } from 'node:crypto';
import { Keypair,Transaction,SystemProgram } from '@solana/web3.js';
import bs58 from 'bs58';
import { eq } from 'drizzle-orm';
import { expect,it,vi } from 'vitest';
import { intentFixture } from '../helpers/funding.js';
import { awardFixture } from '../helpers/awards.js';
import { required,form } from '../helpers/auth.js';
import { bounties,chainTransfers,chainWallets,chainChallenges,awards,payoutBatches,copilotSponsors,bountyActivity } from '../../src/db/schema.js';
import { makeChainTerms,termsSchema } from '../../src/domain/funded-terms.js';
import { walletService } from '../../src/solana/wallet.js';
import { chainService } from '../../src/solana/service.js';
import { acceptSigned,type ChainProvider,type Transfer } from '../../src/solana/provider.js';
import { assertCancellable,hasConfirmedFunding } from '../../src/actions/guards.js';
import { createPayoutService } from '../../src/settlement/payout.js';
import type { Payouts } from '../../src/paypal/payouts.js';
function signature(message:string,key:Keypair){return bs58.encode(sign(null,Buffer.from(message),createPrivateKey({key:Buffer.concat([Buffer.from('302e020100300506032b657004220420','hex'),Buffer.from(key.secretKey.slice(0,32))]),format:'der',type:'pkcs8'})));}
it('wallet HTTP routes enforce feature flag, session, origin and path-bound CSRF; proofs do not prevent logout',async()=>{
 const f=await intentFixture();try{
  expect((await f.request('/api/pyusd')).status).toBe(409);f.env.PYUSD_DEVNET_ENABLED=true;
  expect((await f.request('/api/pyusd',{headers:{Cookie:''}})).status).toBe(401);
  const response=await f.request('/api/pyusd');expect(response.headers.get('cache-control')).toContain('no-store');
  const state=await response.json() as {csrfChallenge:string;csrfConfirm:string;address:string|null};expect(state.address).toBeNull();
  const address=Keypair.generate();
  expect((await f.request('/api/pyusd/wallet/challenge',form('wrong',{address:address.publicKey.toBase58()}))).status).toBe(403);
  const foreign=form(state.csrfChallenge,{address:address.publicKey.toBase58()});foreign.headers.Origin='https://foreign.test';
  expect((await f.request('/api/pyusd/wallet/challenge',foreign)).status).toBe(403);
  const proof=await (await f.request('/api/pyusd/wallet/challenge',form(state.csrfChallenge,{address:address.publicKey.toBase58()}))).json() as {id:string;message:string};
  expect((await f.request('/api/pyusd/wallet/confirm',form(state.csrfChallenge,{id:proof.id,signature:signature(proof.message,address)}))).status).toBe(403);
  expect((await f.request('/api/pyusd/wallet/confirm',form(state.csrfConfirm,{id:proof.id,signature:signature(proof.message,address)}))).status).toBe(200);
  expect((await f.database.orm.select().from(chainWallets))[0]?.ghId).toBe(f.session.ghId);
  await f.auth.logout(f.session.id);expect(await f.database.orm.select().from(chainChallenges)).toHaveLength(0);
  expect((await f.request('/api/pyusd')).status).toBe(401);expect(await f.database.orm.select().from(chainWallets)).toHaveLength(1);
 }finally{await f.close();}
});
function mockProvider(){const treasury=Keypair.generate();const published=new Set<string>();let lost=false;let outcome:'success'|'pending'|'failed'|'unknown'='success';
 const provider:ChainProvider={validPreparation:()=>Promise.resolve(true),treasury:()=>Promise.resolve(treasury.publicKey.toBase58()),prepare:vi.fn(async(input:Transfer,signed:boolean)=>{const tx=new Transaction({feePayer:signed?treasury.publicKey:new Keypair().publicKey,blockhash:Keypair.generate().publicKey.toBase58(),lastValidBlockHeight:100}).add(SystemProgram.transfer({fromPubkey:treasury.publicKey,toPubkey:Keypair.generate().publicKey,lamports:1}));if(signed){tx.feePayer=treasury.publicKey;tx.sign(treasury);}return Promise.resolve({message:tx.serializeMessage().toString('base64'),wire:tx.serialize({requireAllSignatures:false,verifySignatures:false}).toString('base64'),signature:tx.signature?bs58.encode(tx.signature):null,lastValidBlockHeight:100});}),accept:acceptSigned,publish:vi.fn((wire:string)=>{published.add(wire);if(lost){lost=false;return Promise.reject(new Error('lost response'));}return Promise.resolve();}),observe:vi.fn((wire:string)=>Promise.resolve(published.has(wire)?outcome:'pending'))};
 return {provider,treasury,lost:()=>{lost=true;},setOutcome:(value:typeof outcome)=>{outcome=value;},published};
}
async function funding(){const f=await intentFixture(),p=mockProvider(),wallet=Keypair.generate();f.env.PYUSD_DEVNET_ENABLED=true;
 await f.database.orm.insert(chainWallets).values({ghId:f.session.ghId,address:wallet.publicKey.toBase58()});const terms=makeChainTerms(termsSchema.parse({...f.terms,version:4,policy:{...f.terms.policy,model:'auto'}}),p.treasury.publicKey.toBase58(),wallet.publicKey.toBase58());const service=chainService(f.database,f.env,p.provider);
 return {...f,...p,wallet,chainTerms:terms,chain:service};}
it('wallet proof binds account, session, wallet, nonce and expiry; replay cannot rotate destination',async()=>{const f=await intentFixture();try{let now=new Date();const service=walletService(f.database,f.env.PUBLIC_URL,()=>now),key=Keypair.generate(),c=await service.challenge(f.session,key.publicKey.toBase58());
 await expect(service.confirm(f.session,c.id,signature(c.message,Keypair.generate()))).rejects.toThrow();
 await expect(service.confirm({...f.session,id:'other'},c.id,signature(c.message,key))).rejects.toThrow();
 await service.confirm(f.session,c.id,signature(c.message,key));expect((await service.get(f.session.ghId))?.address).toBe(key.publicKey.toBase58());
 await expect(service.confirm(f.session,c.id,signature(c.message,key))).rejects.toThrow();const expired=await service.challenge(f.session,key.publicKey.toBase58());now=new Date(now.getTime()+300001);await expect(service.confirm(f.session,expired.id,signature(expired.message,key))).rejects.toThrow();
 }finally{await f.close();}});
it('competing PayPal and PYUSD reservations cannot both take the same bounty',async()=>{const f=await funding();try{const result=await Promise.allSettled([f.start(),f.chain.reserveFunding(f.session,f.ctx,f.bounty,f.chainTerms)]);expect(result.filter(r=>r.status==='fulfilled')).toHaveLength(1);}finally{await f.close();}});
it('PYUSD reservation blocks draft cancellation and duplicate funding; invalid terms do not reserve',async()=>{const f=await funding();try{
 await expect(f.chain.reserveFunding(f.session,f.ctx,f.bounty,{...f.chainTerms,amountCents:1})).rejects.toThrow();
 const r=await f.chain.reserveFunding(f.session,f.ctx,f.bounty,f.chainTerms);const b=required((await f.database.orm.select().from(bounties))[0]);expect(b.currency).toBe('PYUSD');expect(()=>{assertCancellable(b);}).toThrow();expect(hasConfirmedFunding(b)).toBe(false);
 await expect(f.chain.reserveFunding(f.session,f.ctx,f.bounty,f.chainTerms)).rejects.toThrow();expect(r.terms.policy.fundedCancellationEnabled).toBe(false);
 f.permissions.write=false;expect((await f.request(`/api/pyusd/bounties/${f.bounty.id}`)).status).toBe(200);
 f.permissions.read=false;expect((await f.request(`/api/pyusd/bounties/${f.bounty.id}`)).status).toBe(403);
 }finally{await f.close();}});
it('signed funding requires exact prepared message and owning session; finalized funding never invents a PayPal capture',async()=>{const f=await funding();try{
 const r=await f.chain.reserveFunding(f.session,f.ctx,f.bounty,f.chainTerms);
 const tx=new Transaction({feePayer:f.wallet.publicKey,blockhash:Keypair.generate().publicKey.toBase58(),lastValidBlockHeight:100}).add(SystemProgram.transfer({fromPubkey:f.wallet.publicKey,toPubkey:f.treasury.publicKey,lamports:1}));
 vi.mocked(f.provider.prepare).mockResolvedValue({message:tx.serializeMessage().toString('base64'),wire:tx.serialize({requireAllSignatures:false,verifySignatures:false}).toString('base64'),signature:null,lastValidBlockHeight:100});
 await f.chain.prepareFunding(r.id,f.session);tx.sign(f.wallet);const wire=tx.serialize().toString('base64');
 const changed=Transaction.from(Buffer.from(wire,'base64'));changed.recentBlockhash=Keypair.generate().publicKey.toBase58();changed.sign(f.wallet);
 await expect(f.chain.signFunding(r.id,f.session,changed.serialize().toString('base64'))).rejects.toMatchObject({status:400,message:'The wallet returned an invalid or changed transaction. Nothing was saved or sent by this request. Keep this checkout for investigation; do not send a separate transfer.'});
 expect(await f.chain.get(r.id)).toMatchObject({status:'RESERVED',signature:null});expect(f.provider.publish).not.toHaveBeenCalled();
 await expect(f.chain.signFunding(r.id,{...f.session,ghId:'999'},wire)).rejects.toThrow();await f.chain.signFunding(r.id,f.session,wire);f.lost();await f.chain.reconcile(r.id);expect((await f.chain.get(r.id)).status).toBe('SIGNED');await f.chain.reconcile(r.id);
 expect(f.provider.publish).toHaveBeenCalledTimes(1);const b=required((await f.database.orm.select().from(bounties))[0]);expect(b).toMatchObject({status:'FUNDED',currency:'PYUSD',captureId:null});expect(hasConfirmedFunding(b)).toBe(true);
 }finally{await f.close();}});
async function payout(){const f=await awardFixture(true),p=mockProvider();f.env.PYUSD_DEVNET_ENABLED=true;const terms=makeChainTerms(termsSchema.parse({...f.terms,version:4,policy:{...f.terms.policy,model:'auto'}}),p.treasury.publicKey.toBase58(),Keypair.generate().publicKey.toBase58());
 await f.database.orm.update(bounties).set({currency:'PYUSD',captureId:null,chainFundingId:randomUUID(),chainFundingSignature:'confirmed-test-signature',fundedTerms:terms}).where(eq(bounties.id,f.bounty.id));
 await f.database.orm.update(copilotSponsors).set({modelId:'auto'});
 await f.add('501','2026-10-30T01:00:00Z');await f.service.settleBounty(f.bounty.id);const award=required((await f.database.orm.select().from(awards))[0]);const chain=chainService(f.database,f.env,p.provider);
 return {...f,...p,chain,award,connect:async(id:string)=>{const address=Keypair.generate().publicKey.toBase58();await f.database.orm.insert(chainWallets).values({ghId:id,address}).onConflictDoUpdate({target:chainWallets.ghId,set:{address,version:2}});return address;}};}
it('qualifying merge commits a PYUSD award, waits for both wallets, then snapshots exact split without PayPal intents',async()=>{const f=await payout();try{
 await f.chain.reserveAward(f.award.id);expect(await f.database.orm.select().from(chainTransfers)).toHaveLength(0);const original=await f.connect('8');await f.chain.reserveAward(f.award.id);expect(await f.database.orm.select().from(chainTransfers)).toHaveLength(0);await f.connect('9');await Promise.all([f.chain.reserveAward(f.award.id),f.chain.reserveAward(f.award.id)]);
 const rows=await f.database.orm.select().from(chainTransfers);expect(rows).toHaveLength(2);expect(rows.reduce((n,r)=>n+r.amount,0)).toBe(5000);await f.connect('8');expect(rows.find(r=>r.ghId==='8')?.destination).toBe(original);
 const paypal:Payouts={submit:vi.fn(),get:vi.fn()};await createPayoutService(f.database,f.env,paypal).reserve(f.award.id);expect(await f.database.orm.select().from(payoutBatches)).toHaveLength(0);
 await Promise.all(rows.map(r=>f.chain.reconcile(r.id)));expect((await f.database.orm.select().from(bounties))[0]?.status).toBe('PAID');expect(await f.database.orm.select().from(awards)).toHaveLength(1);
 }finally{await f.close();}});
it('lost response resends only the same signed bytes; immutable destinations and amounts cannot be rewritten',async()=>{const f=await payout();try{await f.connect('8');await f.connect('9');await f.chain.reserveAward(f.award.id);const r=required((await f.database.orm.select().from(chainTransfers))[0]);f.lost();await f.chain.reconcile(r.id);const first=await f.chain.get(r.id);expect(first.signature).toBeTruthy();await expect(f.database.orm.update(chainTransfers).set({destination:Keypair.generate().publicKey.toBase58()}).where(eq(chainTransfers.id,r.id))).rejects.toThrow();await f.chain.reconcile(r.id);expect((await f.chain.get(r.id)).signature).toBe(first.signature);expect(f.provider.publish).toHaveBeenCalledTimes(1);
 }finally{await f.close();}});
it('failed or mismatched receipts preserve awards and never mark the bounty paid',async()=>{const f=await payout();try{await f.connect('8');await f.connect('9');await f.chain.reserveAward(f.award.id);const rows=await f.database.orm.select().from(chainTransfers);f.setOutcome('unknown');for(const r of rows)await f.chain.reconcile(r.id);expect((await f.database.orm.select().from(bounties))[0]).toMatchObject({status:'PAYING',needsAttention:true});expect(await f.database.orm.select().from(awards)).toHaveLength(1);const calls=vi.mocked(f.provider.publish).mock.calls.length;for(const r of rows)await f.chain.reconcile(r.id);expect(f.provider.publish).toHaveBeenCalledTimes(calls);
 }finally{await f.close();}});

// Shared notice/independent-review service is exercised, not bypassed by a wallet transfer command.
it('PYUSD refund needs independent approval and elapsed notice, returns only to the original wallet, and blocks awards',async()=>{
 const {cancellationFixture}=await import('../helpers/cancellation.js');const f=await cancellationFixture(),p=mockProvider();try{
  f.env.PYUSD_DEVNET_ENABLED=true;f.env.PYUSD_REFUNDS_ENABLED=true;
  const original=Keypair.generate(),base=(await f.getBounty()).fundedTerms;if(!base)throw new Error('Terms missing');
  const terms=makeChainTerms(base,p.treasury.publicKey.toBase58(),original.publicKey.toBase58(),true),id=randomUUID();
  const tx=new Transaction({feePayer:original.publicKey,blockhash:Keypair.generate().publicKey.toBase58(),lastValidBlockHeight:100}).add(SystemProgram.transfer({fromPubkey:original.publicKey,toPubkey:p.treasury.publicKey,lamports:1}));tx.sign(original);const wire=tx.serialize().toString('base64'),sig=bs58.encode(required(tx.signature));p.published.add(wire);
  await f.database.orm.insert(chainTransfers).values({id,bountyId:f.bounty.id,kind:'funding',ghId:'4',walletVersion:1,source:original.publicKey.toBase58(),destination:p.treasury.publicKey.toBase58(),amount:5000,terms,message:tx.serializeMessage().toString('base64'),wire,signature:sig,lastValidBlockHeight:100,status:'SUCCESS'});
  await f.database.orm.update(bounties).set({currency:'PYUSD',captureId:null,chainFundingId:id,chainFundingSignature:sig,fundedTerms:terms}).where(eq(bounties.id,f.bounty.id));
  const page=await f.requestPage(`/bounties/${f.bounty.id}/cancellation`);expect(page.status).toBe(200);const html=await page.text();expect(html).toContain('50.00 PYUSD');expect(html).toContain(original.publicKey.toBase58());expect(html).not.toContain('$50.00 USD');
  const chain=chainService(f.database,f.env,p.provider,()=>f.clock.now(),f.cancellation),r=await f.request();await f.cancellation.publish(r.id);
  await expect(chain.reserveRefund(r.id)).rejects.toThrow();await expect(f.cancellation.prepare(f.session,r.id,f.plan)).rejects.toThrow();await expect(f.cancellation.prepare(f.operator,r.id,f.plan)).rejects.toThrow();
  f.advance(73*3600000);const token=await f.cancellation.prepare(f.operator,r.id,f.plan);await f.cancellation.decide(f.operator,token);
  // Changing the current connection must never redirect a refund.
  await f.database.orm.insert(chainWallets).values({ghId:'4',address:Keypair.generate().publicKey.toBase58()});
  const refund=required(await chain.reserveRefund(r.id));expect(refund.destination).toBe(original.publicKey.toBase58());expect((await f.getBounty()).status).toBe('REFUNDING');
  await expect(chain.reserveRefund(r.id)).rejects.toThrow();await chain.reconcile(refund.id);expect((await f.getBounty()).status).toBe('CANCELLED');expect(await f.database.orm.select().from(awards)).toHaveLength(0);
 }finally{await f.close();}
});
it('funding holds prevent broadcast and PYUSD refunds stay disabled for original nonrefundable terms',async()=>{const f=await payout();try{await f.connect('8');await f.connect('9');await f.chain.reserveAward(f.award.id);const r=required((await f.database.orm.select().from(chainTransfers))[0]);await f.database.orm.update(bounties).set({fundingHold:true}).where(eq(bounties.id,f.bounty.id));await f.chain.reconcile(r.id);expect(f.provider.publish).not.toHaveBeenCalled();await expect(f.chain.reserveRefund('1')).rejects.toThrow();}finally{await f.close();}});
it('held ambiguous transfers can observe late success without broadcasting a replacement',async()=>{const f=await payout();try{await f.connect('8');await f.connect('9');await f.chain.reserveAward(f.award.id);const r=required((await f.database.orm.select().from(chainTransfers))[0]);f.setOutcome('unknown');await f.chain.reconcile(r.id);expect((await f.chain.get(r.id)).status).toBe('HOLD');const sig=(await f.chain.get(r.id)).signature;f.setOutcome('success');await f.chain.reconcile(r.id);expect(await f.chain.get(r.id)).toMatchObject({status:'SUCCESS',signature:sig});expect(f.provider.publish).toHaveBeenCalledTimes(1);}finally{await f.close();}});

it('signing preflight rejects expired preparations without replacing immutable bytes or sending funds',async()=>{
 const f=await funding();try{
  const r=await f.chain.reserveFunding(f.session,f.ctx,f.bounty,f.chainTerms);
  expect(r.message).toBeNull();expect(r.wire).toBeNull();expect(f.provider.prepare).not.toHaveBeenCalled();
  const prepared=await f.chain.prepareFunding(r.id,f.session);
  f.provider.validPreparation=vi.fn(()=>Promise.resolve(false));
  await expect(f.chain.signingReady(r.id,f.session)).rejects.toThrow('expired');
  expect(await f.chain.get(r.id)).toMatchObject({message:prepared.message,wire:prepared.wire,status:'RESERVED',signature:null});expect(f.provider.publish).not.toHaveBeenCalled();
  f.provider.validPreparation=vi.fn(()=>Promise.resolve(true));
  await expect(f.chain.signingReady(r.id,f.session)).resolves.toMatchObject({id:r.id,message:prepared.message});
 }finally{await f.close();}
});

it('recovers expired unsigned funding on the same bounty once, preserving immutable history and rejecting late signatures',async()=>{
 const f=await funding();try{
  const r=await f.chain.reserveFunding(f.session,f.ctx,f.bounty,f.chainTerms),old=await f.chain.prepareFunding(r.id,f.session);
  f.provider.validPreparation=vi.fn(()=>Promise.resolve(false));f.provider.expiredUnfunded=vi.fn(()=>Promise.resolve({slot:200,height:200}));
  const results=await Promise.allSettled([f.chain.signingReady(r.id,f.session),f.chain.signingReady(r.id,f.session)]);
  expect(results.filter(x=>x.status==='fulfilled')).toHaveLength(1);
  const b=required((await f.database.orm.select().from(bounties))[0]);expect(b.chainFundingId).not.toBe(r.id);expect(b).toMatchObject({status:'CAPTURING',amountCents:f.bounty.amountCents,currency:'PYUSD'});
  const next=await f.chain.get(required(b.chainFundingId));expect(next).toMatchObject({supersedesId:r.id,source:r.source,destination:r.destination,amount:r.amount,terms:r.terms,status:'RESERVED',signature:null});expect(next.message).not.toBe(old.message);
  expect(await f.chain.get(r.id)).toMatchObject({status:'EXPIRED',message:old.message,wire:old.wire,signature:null});
  await expect(f.database.orm.update(chainTransfers).set({status:'RESERVED'}).where(eq(chainTransfers.id,r.id))).rejects.toThrow();
  vi.spyOn(f.provider,'accept').mockReturnValue({signature:'late-signature',wire:'late-wire'});
  await expect(f.chain.signFunding(r.id,f.session,'late-wire')).rejects.toThrow();
  await f.chain.reconcile(r.id);expect(f.provider.publish).not.toHaveBeenCalled();
  expect(await f.database.orm.select().from(chainTransfers)).toHaveLength(2);
 }finally{await f.close();}
});
it.each(['uncertain','rpc-error','hold','wrong-owner','signed'] as const)('cannot replace an expired preparation when %s',async scenario=>{
 const f=await funding();try{
  const r=await f.chain.reserveFunding(f.session,f.ctx,f.bounty,f.chainTerms);await f.chain.prepareFunding(r.id,f.session);
  f.provider.validPreparation=vi.fn(()=>Promise.resolve(false));f.provider.expiredUnfunded=vi.fn(()=>scenario==='rpc-error'?Promise.reject(new Error('RPC unavailable')):Promise.resolve(scenario==='uncertain'?null:{slot:200,height:200}));
  if(scenario==='hold')await f.database.orm.update(bounties).set({fundingHold:true}).where(eq(bounties.id,f.bounty.id));
  if(scenario==='signed')await f.database.orm.update(chainTransfers).set({signature:'already-signed',status:'SIGNED'}).where(eq(chainTransfers.id,r.id));
  await expect(f.chain.signingReady(r.id,scenario==='wrong-owner'?{...f.session,ghId:'other'}:f.session)).rejects.toThrow();
  expect(await f.database.orm.select().from(chainTransfers)).toHaveLength(1);expect((await f.database.orm.select().from(bounties))[0]?.chainFundingId).toBe(r.id);expect(f.provider.publish).not.toHaveBeenCalled();
 }finally{await f.close();}
});

it('immediate funding submission commits exact signed bytes before provider calls and replay preserves identity',async()=>{
 const f=await funding();try{
  const r=await f.chain.reserveFunding(f.session,f.ctx,f.bounty,f.chainTerms);
  const tx=new Transaction({feePayer:f.wallet.publicKey,blockhash:Keypair.generate().publicKey.toBase58(),lastValidBlockHeight:100}).add(SystemProgram.transfer({fromPubkey:f.wallet.publicKey,toPubkey:f.treasury.publicKey,lamports:1}));
  vi.mocked(f.provider.prepare).mockResolvedValue({message:tx.serializeMessage().toString('base64'),wire:tx.serialize({requireAllSignatures:false,verifySignatures:false}).toString('base64'),signature:null,lastValidBlockHeight:100});
  await f.chain.prepareFunding(r.id,f.session);tx.sign(f.wallet);const wire=tx.serialize().toString('base64');
  f.setOutcome('pending');
  vi.mocked(f.provider.publish).mockImplementation(async received=>{
   const saved=await f.chain.get(r.id);expect(saved).toMatchObject({status:'SIGNED',wire:received,signature:bs58.encode(required(tx.signature))});f.published.add(received);
  });
  await expect(f.chain.submitFunding(r.id,{...f.session,ghId:'wrong'},wire)).rejects.toThrow();expect(f.provider.publish).not.toHaveBeenCalled();
  await f.chain.submitFunding(r.id,f.session,wire);expect(f.provider.publish).toHaveBeenCalledTimes(1);
  f.setOutcome('success');await f.chain.submitFunding(r.id,f.session,wire);
  expect((await f.chain.get(r.id)).status).toBe('SUCCESS');expect(f.provider.publish).toHaveBeenCalledTimes(1);expect(await f.database.orm.select().from(chainTransfers)).toHaveLength(1);
 }finally{await f.close();}
});

it('signed expiry is restricted to the exact approved devnet identity and fresh audit, preserving all old bytes',async()=>{
 const f=await funding();try{
  const id='4bb59a11-101f-4649-9e47-c05413f31dee',sig='2Mr5oBco4iTeQzofjQAokuewjj99vRw6HinxHCoamJ9gBt5fmeRC1GuGZPX8uAzaBZptBcjeSJnenCf7xvGgda6L';
  const source='AM19gZaXJUvT7UsBFUn8XbXoE5Grga81C8xht6M4UmnM',destination='CC6eMUZhcBddPsC1oLwfQHCC2ipTVVtP3Vw1rzpTkVAb';
  const terms=makeChainTerms(termsSchema.parse({...f.terms,version:4,amountCents:100,issueNumber:21,policy:{...f.terms.policy,model:'auto'}}),destination,source);
  await f.database.orm.insert(bounties).values({...f.bounty,id:'9',repoFullName:'deepakA18/gitpay-demo-http',issueNumber:21,amountCents:100,currency:'PYUSD',status:'CAPTURING',chainFundingId:id,fundedTerms:terms});
  const values={id,bountyId:'9',kind:'funding' as const,ghId:f.session.ghId,walletVersion:1,source,destination,amount:100,terms,signature:sig,wire:'immutable signed fixture bytes',message:'immutable fixture message',lastValidBlockHeight:507901017,status:'HOLD' as const};
  await f.database.orm.insert(chainTransfers).values(values);
  const expire=()=>f.database.orm.update(chainTransfers).set({status:'EXPIRED'}).where(eq(chainTransfers.id,id));
  await expect(expire()).rejects.toThrow();
  const proof={approval:'call_6d51e3ccebd64fb1a2ddcd3ce220f8ba',transferId:id,signature:sig,wireSha256:createHash('sha256').update(values.wire).digest('hex'),finalizedHeight:507901100,finalizedSlot:600000000,genesis:'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG',blockhashValid:false,signatureAbsent:true,referenceTransactions:0};
  await f.database.orm.insert(bountyActivity).values({bountyId:'9',source:'operator',action:'pyusd_scoped_signed_expiry_approved',metadata:{...proof,signatureAbsent:false}});
  await expect(expire()).rejects.toThrow();
  await f.database.orm.insert(bountyActivity).values({bountyId:'9',source:'operator',action:'pyusd_scoped_signed_expiry_approved',metadata:proof});
  await expire();expect(await f.chain.get(id)).toMatchObject({...values,status:'EXPIRED'});
  await expect(f.database.orm.update(chainTransfers).set({wire:'changed'}).where(eq(chainTransfers.id,id))).rejects.toThrow();
  await expect(f.database.orm.update(chainTransfers).set({status:'SIGNED'}).where(eq(chainTransfers.id,id))).rejects.toThrow();
  await f.database.orm.insert(chainTransfers).values({...values,id:'replacement',supersedesId:id,status:'RESERVED',signature:null,message:null,wire:null,lastValidBlockHeight:null});
  await f.database.orm.update(chainTransfers).set({signature:'other-signed',message:'other-message',wire:'other-wire',lastValidBlockHeight:507901017,status:'HOLD'}).where(eq(chainTransfers.id,'replacement'));
  await expect(f.database.orm.update(chainTransfers).set({status:'EXPIRED'}).where(eq(chainTransfers.id,'replacement'))).rejects.toThrow();
  await f.chain.reconcile(id);expect(f.provider.publish).not.toHaveBeenCalled();
 }finally{await f.close();}
});
