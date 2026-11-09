import { test,expect } from '@playwright/test';

test('maintainer funding pending to scoped status and stale confirmation recovery',async({page})=>{
 await page.goto('/_test/login/maintainer');await page.goto('/bounties/2/fund');await expect(page.getByRole('heading',{level:1})).toContainText(/funding|checkout/i);await expect(page.getByText(/PENDING/).first()).toBeVisible();await page.goto('/bounties/2');await expect(page.getByText(/capture is not yet confirmed/)).toBeVisible();await page.goto('/a/eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee');await expect(page.getByText(/expired|fresh|changed/i).first()).toBeVisible();
});

test('contributor updates a payout destination through the workspace confirmation',async({page})=>{
 await page.goto('/_test/login/contributor');await page.goto('/dashboard/payouts/settings');await expect(page.getByRole('heading',{name:/Payout settings/i})).toBeVisible();await page.getByLabel('PayPal recipient email').fill('recipient@example.test');await page.getByRole('button',{name:'Update Destination'}).click();await expect(page.getByRole('dialog',{name:'Confirm PayPal payout destination'})).toBeVisible();await page.getByRole('button',{name:'Confirm & Save'}).click();await expect(page.getByRole('status')).toContainText(/PayPal destination saved/);await page.goto('/dashboard/payouts');await expect(page.getByRole('heading',{name:/Payout disbursements/i})).toBeVisible();await expect(page.getByRole('region',{name:'Disbursement ledger'})).toBeVisible();
});

test('operator cancellation review exposes evidence without promising a refund',async({page})=>{
 await page.goto('/_test/login/operator');await page.goto('/cancellations/1');await expect(page.getByRole('heading',{name:'Funded criteria'})).toBeVisible();await expect(page.getByText(/original capture/).first()).toBeVisible();await expect(page.getByText(/notice clock has not started/)).toBeVisible();await expect(page.getByRole('button',{name:'Preview independent decision'})).toBeVisible();
});

test('server status hides private state when repository access is lost',async({page})=>{
 await page.goto('/_test/login/maintainer');await page.goto('/bounties/3');await page.request.post('/_test/revoke');await expect(page.getByText(/Unable to refresh/)).toBeVisible({timeout:15000});await expect(page.getByText('demo/repo',{exact:true})).toHaveCount(0);
});
