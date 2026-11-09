import { test,expect } from '@playwright/test';

test('malicious issue markup remains text and never creates an executable dashboard element',async({page})=>{
 await page.goto('/_test/login/maintainer');await expect(page.getByRole('heading',{name:'Escrow overview'})).toBeVisible();await expect(page.getByRole('button',{name:'<img src=x onerror="window.injected=true">'})).toBeVisible();expect(await page.evaluate(()=>Object.hasOwn(window,'injected'))).toBe(false);expect(await page.locator('img[onerror]').count()).toBe(0);
});
