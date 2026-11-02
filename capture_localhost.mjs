import { Browser } from './.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs';
import path from 'node:path';

const outDir = '/Users/mecha/.gemini/antigravity/brain/a63efe2c-bada-4b46-891a-18b87bf51fc1/screenshots';
const devCookie = 'gd2Swn-K6O2NiLAzOmHeX73Q3qX1N9ElEYJ_aASPR7I';

async function main() {
  const browser = await Browser.launch();
  try {
    const page = await browser.newPage({ width: 1440, height: 960 });

    // 1. Signed out root
    console.log('Capturing localhost_01_signed_out.png...');
    await page.goto('http://127.0.0.1:3000/');
    await page.screenshot({ path: path.join(outDir, 'localhost_01_signed_out.png'), format: 'png' });

    // Set auth cookie
    await page.send('Network.enable');
    await page.send('Network.setCookie', {
      name: 'repopay_session',
      value: devCookie,
      domain: '127.0.0.1',
      path: '/'
    });

    // 2. Signed in session
    console.log('Capturing localhost_02_signed_in.png...');
    await page.goto('http://127.0.0.1:3000/');
    await page.screenshot({ path: path.join(outDir, 'localhost_02_signed_in.png'), format: 'png' });

    // 3. Connect PayPal
    console.log('Capturing localhost_03_connect_paypal.png...');
    await page.goto('http://127.0.0.1:3000/connect');
    await page.screenshot({ path: path.join(outDir, 'localhost_03_connect_paypal.png'), format: 'png' });

    // 4. React Dashboard
    console.log('Capturing localhost_04_dashboard.png...');
    await page.goto('http://127.0.0.1:3000/dashboard/');
    // Wait an extra second for React hydration and initial fetch
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: path.join(outDir, 'localhost_04_dashboard.png'), format: 'png' });

    console.log('All localhost screenshots captured successfully.');
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('Capture failed:', err);
  process.exit(1);
});
