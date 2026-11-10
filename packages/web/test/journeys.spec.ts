import { test,expect } from '@playwright/test';
import { ComputeBudgetProgram,Keypair } from '@solana/web3.js';
import { transferTransaction } from '../../server/src/solana/provider.js';

for(const changedFee of [false,true])test('PYUSD funding validates wallet bytes; changed fee '+String(changedFee),async({page})=>{
 const signer=Keypair.generate(),address=signer.publicKey.toBase58();
 const tx=transferTransaction({from:address,to:Keypair.generate().publicKey.toBase58(),amount:100,reference:'browser-fixture'},signer.publicKey,{blockhash:Keypair.generate().publicKey.toBase58(),lastValidBlockHeight:100});
 const wire=tx.serialize({requireAllSignatures:false,verifySignatures:false}).toString('base64');if(changedFee)tx.instructions[1]=ComputeBudgetProgram.setComputeUnitPrice({microLamports:200000});tx.sign(signer);if(!tx.signature)throw new Error('Missing fixture signature');const expected=tx.serialize().toString('base64');let saved=false,reserved=false;
 await page.addInitScript(({address,signedWire})=>{
  const account={address,publicKey:new Uint8Array(32),chains:['solana:devnet'],features:['solana:signTransaction']};
  const wallet={version:'1.0.0',name:'Solflare',icon:'data:image/svg+xml;base64,',chains:['solana:devnet'],accounts:[account],features:{'standard:connect':{version:'1.0.0',connect:()=>Promise.resolve({accounts:[account]})},'solana:signTransaction':{version:'1.0.0',supportedTransactionVersions:['legacy'],signTransaction:(input:{chain:string})=>{if(input.chain!=='solana:devnet')throw new Error('Missing devnet signing context');return Promise.resolve([{signedTransaction:Uint8Array.from(atob(signedWire),c=>c.charCodeAt(0))}]);}}}};
  window.addEventListener('wallet-standard:app-ready',((event:CustomEvent<{register:(wallet:unknown)=>void}>)=> { event.detail.register(wallet); }) as EventListener);
 },{address,signedWire:expected});
 await page.route('**/api/pyusd',route=>route.fulfill({json:{login:'maintainer',address,csrfChallenge:'challenge',csrfConfirm:'confirm'}}));
 await page.route('**/api/pyusd/bounties/1',async route=>{
  if(route.request().method()==='POST'){reserved=true;await route.fulfill({json:{reserved:true,id:'intent'}});return;}
  await route.fulfill({json:{...(reserved?{status:'CAPTURING',id:'intent',wire:null,signature:saved?'saved-signature':null,transferStatus:saved?'SIGNED':'RESERVED',csrfSign:'sign-csrf',csrfPrepare:'prepare-csrf'}:{status:'OPEN',hash:'terms-hash',csrfReserve:'reserve-csrf'}),amount:1,terms:{title:'Devnet test bounty',criteria:'Fixture criteria',policy:{fundedCancellationEnabled:false},chain:{treasury:'test-treasury',refundWallet:address}}}});
 });
 await page.route('**/api/pyusd/transfers/intent/prepare',route=>route.fulfill({json:{saved:true,id:'intent',wire,csrfSign:'sign-csrf'}}));
 await page.route('**/api/pyusd/transfers/intent/sign',async route=>{const body=new URLSearchParams(route.request().postData()??'');expect(body.get('wire')).toBe(expected);expect(body.get('csrf')).toBe('sign-csrf');saved=true;await route.fulfill({json:{saved:true}});});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/_test/login/maintainer');await page.goto('/dashboard/wallet?funding=1');
 await expect(page.getByRole('button',{name:'Change saved wallet'})).toBeVisible();await page.getByRole('button',{name:'Confirm terms and fund with wallet'}).click();if(changedFee){await expect(page.getByRole('alert')).toContainText('instruction 2: compute price 100000 → compute price 200000');expect(saved).toBe(false);await page.getByRole('button',{name:'Refresh status',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Wallet changed the prepared transaction');}else{await expect(page.getByText(/CAPTURING \/ SIGNED/)).toBeVisible();expect(saved).toBe(true);}expect(errors).toEqual([]);
});

test('maintainer can inspect contribution details from the dashboard',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('/_test/login/maintainer');await expect(page.getByRole('heading',{name:'Escrow overview'})).toBeVisible();await expect(page.getByRole('region',{name:'Overview metrics'})).toBeVisible();await page.getByRole('button',{name:/Manage All/}).click();await expect(page.getByRole('heading',{name:/Contribution management/i})).toBeVisible();await page.getByRole('searchbox',{name:'Search contributions'}).fill('Parser issue 3');await page.getByRole('button',{name:'Parser issue 3'}).click();await expect(page.getByRole('dialog',{name:'Parser issue 3'})).toBeVisible();await expect(page.getByText('Notice does not mean money was refunded unless approved.')).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('heading',{name:'Parser issue 3'})).toHaveCount(0);
 expect(errors.filter(e=>/AG Grid|license|Enterprise|Content Security Policy/i.test(e))).toEqual([]);
});

test('permission revocation removes dashboard records and reconnect restores them',async({page})=>{
 await page.goto('/_test/login/maintainer');await expect(page.getByRole('heading',{name:'Escrow overview'})).toBeVisible();await page.request.post('/_test/revoke');await page.getByRole('button',{name:'Refresh'}).click();await expect(page.getByText('demo/repo',{exact:true})).toHaveCount(0);await page.goto('/_test/login/maintainer');await expect(page.getByRole('heading',{name:'Escrow overview'})).toBeVisible();await expect(page.getByRole('button',{name:/demo\/repo/})).toBeVisible();
});

for(const width of [375,768,1280])test('responsive dashboard at '+String(width)+'px',async({page})=>{
 await page.setViewportSize({width,height:900});await page.goto('/_test/login/contributor');await expect(page.getByRole('heading',{name:'Escrow overview'})).toBeVisible();await expect(page.getByRole('region',{name:'Overview metrics'})).toBeVisible();const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);expect(overflow).toBe(false);await page.screenshot({path:'test-results/dashboard-'+String(width)+'.png',fullPage:true});
});

test('partial review and a failed payout remain visible without cancelling the committed award',async({page})=>{
 await page.goto('/_test/login/contributor');await page.goto('/dashboard/contributions');await expect(page.getByRole('heading',{name:/Contribution management/i})).toBeVisible();await page.getByRole('button',{name:'Parser issue 4'}).click();await expect(page.getByText('Malformed input is rejected, but the empty-body regression is missing.')).toBeVisible();await expect(page.getByText('Add the empty-body regression test.')).toBeVisible();await page.keyboard.press('Escape');await page.goto('/dashboard/payouts');await expect(page.getByRole('heading',{name:/Payout disbursements/i})).toBeVisible();const ledger=page.getByRole('region',{name:'Disbursement ledger'});await expect(ledger.getByText('Attention Needed').first()).toBeVisible();await expect(ledger).toContainText('$0.00');await expect(ledger).not.toContainText('Cancelled');
});

for(const width of [390,768,1440])test('PYUSD settings and checkout fit '+String(width)+'px without losing terms or actions',async({page})=>{
 await page.setViewportSize({width,height:1000});
 const address='AM19gZaXJUvT7UsBFUn8XbXoE5Grga81C8xht6M4UmnM';
 let connected=false,paid=false;
 await page.route('**/api/pyusd',r=>r.fulfill({json:{login:'maintainer',address:connected?address:null,csrfChallenge:'fixture',csrfConfirm:'fixture'}}));
 await page.route('**/api/pyusd/bounties/9',r=>r.fulfill({json:{status:paid?'PAID':'OPEN',...(paid?{signature:'fixture-signature',transferStatus:'SUCCESS'}:{hash:'fixture',csrfReserve:'fixture'}),amount:1,terms:{title:'Decode one leading JSON BOM',criteria:'## Acceptance criteria\nPreserve a BOM inside JSON string values.\n<script>window.injected=true</script>',policy:{fundedCancellationEnabled:false},chain:{treasury:'CC6eMUZhcBddPsC1oLwfQHCC2ipTVVtP3Vw1rzpTkVAb',refundWallet:address}}}}));
 await page.goto('/_test/login/maintainer');await page.goto('/dashboard/wallet');
 await expect(page.getByRole('button',{name:'Connect and save wallet'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
 await page.evaluate(()=>{window.scrollTo(0,0);});
 await page.screenshot({path:'test-results/pyusd-empty-'+String(width)+'.png',fullPage:true});
 connected=true;await page.goto('/dashboard/wallet?funding=9');
 await expect(page.getByRole('button',{name:'Change saved wallet'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Confirm terms and fund with wallet'})).toBeVisible();
 await expect(page.getByText('Funded cancellation/refunds are unavailable in these terms.',{exact:false})).toBeVisible();
 await page.getByText('Acceptance criteria',{exact:true}).click();
 await expect(page.getByText('Preserve a BOM inside JSON string values.',{exact:false})).toBeVisible();
 expect(await page.evaluate(()=>Reflect.has(window,'injected'))).toBe(false);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
 await page.evaluate(()=>{window.scrollTo(0,0);});
 await page.screenshot({path:'test-results/pyusd-checkout-'+String(width)+'.png',fullPage:true});
 paid=true;await page.getByRole('button',{name:'Refresh status',exact:true}).click();
 await expect(page.getByText('Settled',{exact:true}).last()).toBeVisible();
 await expect(page.getByRole('link',{name:'View devnet transaction'})).toHaveAttribute('href',/cluster=devnet$/);
 await expect(page.getByRole('button',{name:'Confirm terms and fund with wallet'})).toHaveCount(0);
 await page.evaluate(()=>{window.scrollTo(0,0);});
 await page.screenshot({path:'test-results/pyusd-paid-'+String(width)+'.png',fullPage:true});
});
