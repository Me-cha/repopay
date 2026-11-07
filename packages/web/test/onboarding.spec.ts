import { test,expect } from '@playwright/test';
const welcome='Welcome to Repopay';
test('finishes all six steps and never repeats after refresh or a new browser session',async({page,browser})=>{
 const mutations:string[]=[];page.on('request',r=>{if(r.method()==='POST')mutations.push(new URL(r.url()).pathname);});
 await page.goto('/_test/login/tour?user=9001');
 await expect(page.getByRole('heading',{name:welcome})).toBeVisible();
 for(const title of ['Find your bounties','Inspect the details','See what needs review','Track payment progress','Connect your payout destination']){
  await page.getByRole('button',{name:/Next/}).click();await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();
 }
 await page.getByRole('button',{name:'Done',exact:true}).click();await expect(page.getByRole('heading',{name:'Connect your payout destination',exact:true})).toHaveCount(0);
 await page.reload();expect(await(await page.request.get('/api/onboarding/dashboard')).json()).toMatchObject({seen:true});
 await expect(page.getByRole('alertdialog')).toHaveCount(0);
 const context=await browser.newContext();const second=await context.newPage();
 await second.goto('http://127.0.0.1:4317/_test/login/tour?user=9001');
 await expect(second.getByRole('heading',{name:/Escrow overview/})).toBeVisible();
 await expect(second.getByRole('heading',{name:welcome})).toHaveCount(0);await context.close();expect(mutations).toEqual(['/api/onboarding/dashboard']);
});
test('skip, close, Escape and mid-tour reload each consume the first presentation',async({page})=>{
 for(const [id,action] of [['9002','skip'],['9003','close'],['9004','reload'],['9005','escape']] as const){
  await page.goto('/_test/login/tour?user='+id);await expect(page.getByRole('heading',{name:welcome})).toBeVisible();
  if(action==='skip')await page.getByRole('button',{name:'Skip tour',exact:true}).click();
  if(action==='close')await page.getByRole('button',{name:'Close tour',exact:true}).click();
  if(action==='escape')await page.keyboard.press('Escape');
  if(action!=='reload')await expect(page.getByRole('heading',{name:welcome})).toHaveCount(0);
  await page.reload();await expect(page.getByRole('heading',{name:/Escrow overview/})).toBeVisible();
  await expect(page.getByRole('heading',{name:welcome})).toHaveCount(0);
 }
});
for(const [offset,width] of [320,375,768].entries())test('tour fits '+String(width)+'px and supports Back',async({page})=>{
 await page.setViewportSize({width,height:812});await page.goto('/_test/login/tour?user='+String(9010+offset));
 await expect(page.getByRole('heading',{name:welcome})).toBeVisible();
 await page.getByRole('button',{name:/Next/}).click();await expect(page.getByRole('heading',{name:'Find your bounties',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Back',exact:true}).click();await expect(page.getByRole('heading',{name:welcome})).toBeVisible();
 const dialog=page.getByRole('alertdialog');await expect(dialog.locator('..')).toHaveCSS('opacity','1');const box=await dialog.boundingBox();expect(box).not.toBeNull();if(box){expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width);}
 await page.keyboard.press('Tab');expect(await dialog.evaluate(node=>node.contains(document.activeElement))).toBe(true);
 await page.screenshot({path:'test-results/onboarding-'+String(width)+'.png',animations:'disabled'});
 await page.keyboard.press('Escape');await expect(page.getByRole('heading',{name:welcome})).toHaveCount(0);
});
test('onboarding outage leaves dashboard usable without a tour',async({page})=>{
 await page.route('**/api/onboarding/dashboard',route=>route.fulfill({status:503,contentType:'application/json',body:'{}'}));
 await page.goto('/_test/login/tour?user=9007');await expect(page.getByRole('heading',{name:/Escrow overview/})).toBeVisible();
 await expect(page.getByRole('heading',{name:welcome})).toHaveCount(0);
});

test('empty workspace still supports the entire tour',async({page},testInfo)=>{
 await page.route('**/api/bounties?*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({items:[],nextCursor:null})}));
 await page.route('**/api/payouts?*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({items:[],nextCursor:null})}));
 await page.goto('/_test/login/tour?user='+String(9100+testInfo.repeatEachIndex));
 for(const title of [welcome,'Find your bounties','Inspect the details','See what needs review','Track payment progress','Connect your payout destination']){
  await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();
  await page.getByRole('button',{name:title==='Connect your payout destination'?'Done':/Next/}).click();
 }
 await expect(page.getByRole('alertdialog')).toHaveCount(0);
});
