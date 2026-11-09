import { test,expect } from '@playwright/test';

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
