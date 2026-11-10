import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { act,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { getWallets } from '@wallet-standard/app';
import { Keypair,Transaction } from '@solana/web3.js';
import type { SolanaSignTransactionInput } from '@solana/wallet-standard-features';
import { WalletPage } from '../src/pages/WalletPage.js';
const state={login:'author',address:'SavedDevnetWallet',csrfChallenge:'challenge-csrf',csrfConfirm:'confirm-csrf',network:'solana-devnet'};
beforeEach(()=>{window.history.replaceState({},'','/dashboard/wallet');vi.restoreAllMocks();Object.defineProperty(window,'phantom',{value:undefined,configurable:true});Object.defineProperty(window,'solflare',{value:undefined,configurable:true});});
it.each(['Phantom','Solflare','Backpack','Another Solana Wallet'])('saves an explicit wallet proof through Wallet Standard with %s',async(kind)=>{
 let saved=false;
 const fetcher=vi.spyOn(globalThis,'fetch').mockImplementation((path,options)=>{
  if(path==='/api/pyusd/wallet/challenge')return Promise.resolve(new Response(JSON.stringify({id:'proof-id',message:'Exact server challenge'})));
  if(path==='/api/pyusd/wallet/confirm'){const raw=options?.body;if(!(raw instanceof URLSearchParams))throw new Error('Expected encoded form');const body=raw;expect(body.get('csrf')).toBe('confirm-csrf');expect(body.get('signature')).toBeTruthy();saved=true;return Promise.resolve(new Response(JSON.stringify({saved:true})));}
  return Promise.resolve(new Response(JSON.stringify({...state,address:saved?'NewSavedWallet':null})));
 });
 const account={address:'NewSavedWallet',publicKey:new Uint8Array(32),chains:['solana:devnet'] as const,features:['solana:signMessage'] as const};
 unregister=getWallets().register({version:'1.0.0',name:kind,icon:'data:image/svg+xml;base64,',chains:account.chains,accounts:[account],features:{'standard:connect':{version:'1.0.0',connect:()=>Promise.resolve({accounts:[account]})},'solana:signMessage':{version:'1.0.0',signMessage:({message}:{message:Uint8Array})=>Promise.resolve([{signedMessage:message,signature:new Uint8Array(64).fill(1)}])}}});render(<WalletPage/>);
 fireEvent.click(await screen.findByRole('button',{name:'Connect and save wallet'}));expect(await screen.findByText('NewSavedWallet')).toBeTruthy();expect(fetcher).toHaveBeenCalledTimes(4);
});
it('loads the saved wallet without prompting another signature or asking for PayPal information',async()=>{const fetcher=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify(state)));render(<WalletPage/>);expect(await screen.findByText('SavedDevnetWallet')).toBeTruthy();expect(screen.getByRole('button',{name:'Change saved wallet'})).toBeTruthy();expect(fetcher).toHaveBeenCalledTimes(1);expect(screen.queryByLabelText('PayPal email')).toBeNull();});
it('a failed wallet lookup shows an error rather than claiming the user is disconnected',async()=>{vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify({error:'Session expired'}),{status:401}));render(<WalletPage/>);expect(await screen.findByRole('alert')).toHaveProperty('textContent','Session expired');expect(screen.queryByRole('button',{name:'Connect and save wallet'})).toBeNull();});
it('wallet rejection preserves the saved destination and never confirms ownership on the server',async()=>{
 const fetcher=vi.spyOn(globalThis,'fetch').mockImplementation(()=>Promise.resolve(new Response(JSON.stringify(state))));
 unregister=getWallets().register({version:'1.0.0',name:'Backpack',icon:'data:image/svg+xml;base64,',chains:['solana:devnet'],accounts:[],features:{'standard:connect':{version:'1.0.0',connect:()=>Promise.reject(new Error('Connection rejected'))},'solana:signMessage':{version:'1.0.0',signMessage:vi.fn()}}});
 render(<WalletPage/>);fireEvent.click(await screen.findByRole('button',{name:'Change saved wallet'}));await waitFor(()=>{expect(screen.getByRole('alert').textContent).toBe('Wallet connection: Connection rejected');});expect(fetcher).toHaveBeenCalledTimes(1);expect(screen.getByText('SavedDevnetWallet')).toBeTruthy();
});

let unregister:(()=>void)|undefined;
afterEach(()=>{unregister?.();unregister=undefined;});
function fundingWallet(options:{name?:string;chains?:readonly `solana:${string}`[];expired?:boolean;wrongAccount?:boolean;draft?:boolean;connectRejected?:boolean;replacement?:boolean}={}){
 const key=Keypair.generate(),address=key.publicKey.toBase58();
 const tx=new Transaction(),wire=btoa('prepared-wire');
 vi.spyOn(Transaction,'from').mockReturnValue(tx);
 vi.spyOn(tx,'serializeMessage').mockReturnValue(Buffer.from('same-prepared-message'));
 vi.spyOn(tx,'serialize').mockReturnValue(Buffer.from('signed-wire'));
 const account={address:options.wrongAccount?'another-wallet':address,publicKey:key.publicKey.toBytes(),chains:options.chains??['solana:devnet'] as const,features:['solana:signTransaction'] as const};
 const signTransaction=vi.fn(async(input:SolanaSignTransactionInput)=>{expect(input.chain).toBe('solana:devnet');expect(input.account).toBe(account);return Promise.resolve([{signedTransaction:Uint8Array.from([1,2,3])}]);});
 unregister=getWallets().register({version:'1.0.0',name:options.name??'Solflare',icon:'data:image/svg+xml;base64,',chains:account.chains,accounts:[account],features:{'standard:connect':{version:'1.0.0',connect:()=>options.connectRejected?Promise.reject(new Error('Wallet connection rejected')):Promise.resolve({accounts:[account]})},'solana:signTransaction':{version:'1.0.0',supportedTransactionVersions:['legacy'],signTransaction}}});
 window.history.replaceState({},'','/dashboard/wallet?funding=7');
 let reserved=!options.draft;
 const fetcher=vi.spyOn(globalThis,'fetch').mockImplementation((path,requestOptions)=>{
  if(path==='/api/pyusd/bounties/7'&&requestOptions?.method==='POST'){reserved=true;return Promise.resolve(new Response(JSON.stringify({reserved:true,id:'intent'})));}
  if(path==='/api/pyusd')return Promise.resolve(new Response(JSON.stringify({...state,address})));
  if(path==='/api/pyusd/transfers/intent/prepare')return Promise.resolve(new Response(JSON.stringify(options.expired?{error:'This devnet transaction has expired.'}:{saved:true,id:options.replacement?'new-intent':'intent',wire,csrfSign:options.replacement?'new-sign':'sign'}),{status:options.expired?409:200}));
  if(path==='/api/pyusd/transfers/intent/sign'||path==='/api/pyusd/transfers/new-intent/sign')return Promise.resolve(new Response(JSON.stringify({saved:true})));
  return Promise.resolve(new Response(JSON.stringify({...(reserved?{status:'CAPTURING',id:'intent',wire:null,csrfSign:'sign',csrfPrepare:'prepare'}:{status:'OPEN',hash:'terms-hash',csrfReserve:'reserve'}),amount:1,terms:{title:'Devnet bounty',criteria:'Tests',policy:{fundedCancellationEnabled:false},chain:{treasury:'treasury',refundWallet:address}}})));
 });
 return {signTransaction,fetcher};
}
it.each(['Solflare','Phantom','Backpack','Another Solana Wallet'])('passes explicit devnet context to %s and submits the exact signed message',async name=>{
 const f=fundingWallet({name});render(<WalletPage/>);fireEvent.click(await screen.findByRole('button',{name:'Continue funding in wallet'}));
 await waitFor(()=> { expect(f.fetcher.mock.calls.some(([p])=>p==='/api/pyusd/transfers/intent/sign')).toBe(true); });expect(f.signTransaction).toHaveBeenCalledTimes(1);
});
it.each([{chains:['solana:mainnet'] as const},{wrongAccount:true},{expired:true}])('does not request a signature for an unsupported network, wrong account or expired preparation: %j',async options=>{
 const f=fundingWallet(options);render(<WalletPage/>);fireEvent.click(await screen.findByRole('button',{name:'Continue funding in wallet'}));await screen.findByRole('alert');expect(f.signTransaction).not.toHaveBeenCalled();expect(f.fetcher.mock.calls.some(([p])=>p==='/api/pyusd/transfers/intent/sign')).toBe(false);
});

it('confirms terms and signs in one flow, preparing only after wallet connection and reservation',async()=>{
 const f=fundingWallet({draft:true});render(<WalletPage/>);fireEvent.click(await screen.findByRole('button',{name:'Confirm terms and fund with wallet'}));
 await waitFor(()=>{expect(f.fetcher.mock.calls.some(([p])=>p==='/api/pyusd/transfers/intent/sign')).toBe(true);});
 const posts=f.fetcher.mock.calls.filter(([,o])=>o?.method==='POST').map(([p])=>p);
 expect(posts).toEqual(['/api/pyusd/bounties/7','/api/pyusd/transfers/intent/prepare','/api/pyusd/transfers/intent/sign']);expect(f.signTransaction).toHaveBeenCalledTimes(1);
});
it('rejecting wallet connection leaves the draft unreserved and unprepared',async()=>{
 const f=fundingWallet({draft:true,connectRejected:true});render(<WalletPage/>);fireEvent.click(await screen.findByRole('button',{name:'Confirm terms and fund with wallet'}));
 expect(await screen.findByRole('alert')).toHaveProperty('textContent','Wallet connection: Wallet connection rejected');expect(f.fetcher.mock.calls.some(([,o])=>o?.method==='POST')).toBe(false);
});

it('submits a recovered attempt with its new identity and CSRF, never the expired identity',async()=>{
 const f=fundingWallet({replacement:true});render(<WalletPage/>);fireEvent.click(await screen.findByRole('button',{name:'Continue funding in wallet'}));
 await waitFor(()=>{expect(f.fetcher.mock.calls.some(([p])=>p==='/api/pyusd/transfers/new-intent/sign')).toBe(true);});
 const post=f.fetcher.mock.calls.find(([p])=>p==='/api/pyusd/transfers/new-intent/sign');expect((post?.[1]?.body as URLSearchParams).get('csrf')).toBe('new-sign');
 expect(f.fetcher.mock.calls.some(([p])=>p==='/api/pyusd/transfers/intent/sign')).toBe(false);
});
it('shows the wallet signature failure beside checkout without submitting a payment',async()=>{
 const f=fundingWallet();f.signTransaction.mockRejectedValue(new Error('Wallet extension disconnected'));
 render(<WalletPage/>);fireEvent.click(await screen.findByRole('button',{name:'Continue funding in wallet'}));
 expect(await screen.findByRole('alert')).toHaveProperty('textContent','Wallet signature: Wallet extension disconnected');
 expect(f.fetcher.mock.calls.some(([p])=>typeof p==='string'&&p.endsWith('/sign'))).toBe(false);
 fireEvent.click(screen.getByRole('button',{name:'Refresh status'}));
 await waitFor(()=>{expect(screen.getByRole('button',{name:'Refresh status'}).hasAttribute('disabled')).toBe(false);});
 expect(screen.getByRole('alert')).toHaveProperty('textContent','Wallet signature: Wallet extension disconnected');
});


it('discovers late registrations and refuses a removed selected wallet without silently switching',async()=>{
 vi.spyOn(globalThis,'fetch').mockImplementation(()=>Promise.resolve(new Response(JSON.stringify(state))));
 render(<WalletPage/>);await screen.findByText('SavedDevnetWallet');
 expect(screen.queryByRole('combobox')).toBeNull();
 const connector=vi.fn(),signMessage=vi.fn();let remove=()=>{};
 act(()=>{remove=getWallets().register({version:'1.0.0',name:'Backpack',icon:'data:image/svg+xml;base64,',chains:['solana:devnet'],accounts:[],features:{'standard:connect':{version:'1.0.0',connect:connector},'solana:signMessage':{version:'1.0.0',signMessage}}});});
 fireEvent.change(screen.getByRole('combobox'),{target:{value:'Backpack'}});
 expect(screen.getByRole('option',{name:'Backpack'})).toBeTruthy();
 act(()=>{remove();});
 fireEvent.click(screen.getByRole('button',{name:'Change saved wallet'}));
 expect(await screen.findByRole('alert')).toHaveProperty('textContent',expect.stringContaining('No compatible devnet wallet'));expect(connector).not.toHaveBeenCalled();expect(signMessage).not.toHaveBeenCalled();
});
it('rejects an altered ownership message before saving a wallet',async()=>{
 const fetcher=vi.spyOn(globalThis,'fetch').mockImplementation(path=>Promise.resolve(new Response(JSON.stringify(path==='/api/pyusd/wallet/challenge'?{id:'proof',message:'original'}:state))));
 const account={address:'candidate',publicKey:new Uint8Array(32),chains:['solana:devnet'] as const,features:['solana:signMessage'] as const};
 unregister=getWallets().register({version:'1.0.0',name:'Backpack',icon:'data:image/svg+xml;base64,',chains:account.chains,accounts:[account],features:{'standard:connect':{version:'1.0.0',connect:()=>Promise.resolve({accounts:[account]})},'solana:signMessage':{version:'1.0.0',signMessage:()=>Promise.resolve([{signedMessage:new TextEncoder().encode('changed'),signature:new Uint8Array(64)}])}}});
 render(<WalletPage/>);fireEvent.click(await screen.findByRole('button',{name:'Change saved wallet'}));
 expect(await screen.findByRole('alert')).toHaveProperty('textContent',expect.stringContaining('Wallet changed the ownership message'));
 expect(fetcher.mock.calls.some(([p])=>p==='/api/pyusd/wallet/confirm')).toBe(false);
});

it('uses the selected wallet when multiple compatible wallets are installed',async()=>{
 const f=fundingWallet(),original=getWallets().get()[0];if(!original)throw new Error('Missing fixture wallet');
 const signTransaction=vi.fn(async(input:SolanaSignTransactionInput)=>{expect(input.chain).toBe('solana:devnet');return Promise.resolve([{signedTransaction:Uint8Array.from([1,2,3])}]);});
 const remove=getWallets().register({...original,name:'Backpack',features:{...original.features,'solana:signTransaction':{version:'1.0.0',supportedTransactionVersions:['legacy'],signTransaction}}});
 try{render(<WalletPage/>);await screen.findByRole('button',{name:'Continue funding in wallet'});fireEvent.change(screen.getByRole('combobox'),{target:{value:'Backpack'}});fireEvent.click(screen.getByRole('button',{name:'Continue funding in wallet'}));await waitFor(()=>{expect(signTransaction).toHaveBeenCalledTimes(1);});expect(f.signTransaction).not.toHaveBeenCalled();}finally{remove();}
});
