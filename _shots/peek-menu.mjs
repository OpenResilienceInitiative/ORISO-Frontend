import { chromium } from 'playwright';
const [out, id, w, h, clickSel] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, locale: 'de-DE' });
await page.goto(`http://localhost:6099/iframe.html?id=${id}&viewMode=story`, { waitUntil: 'networkidle' });
await page.waitForSelector('#storybook-root > *', { state: 'attached', timeout: 60000 });
await page.waitForTimeout(1500);
if (clickSel) { await page.locator(clickSel).first().click(); await page.waitForTimeout(400); }
await page.screenshot({ path: out });
await browser.close();
