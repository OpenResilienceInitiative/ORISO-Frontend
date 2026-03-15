const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });

  const figmaPage = await ctx.newPage();
  await figmaPage.goto('https://www.figma.com/design/Y7PJA0yRXm8R8i49kFnnvP/ORISO?node-id=84-14745&t=gfdDHfZuUusXoUZQ-0', { waitUntil: 'networkidle', timeout: 120000 });
  await figmaPage.waitForTimeout(7000);
  await figmaPage.screenshot({ path: '.tmp-proof/figma-node-full.png', fullPage: true });

  const appPage = await ctx.newPage();
  await appPage.goto('https://app.oriso-dev.site', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await appPage.waitForTimeout(3000);

  const userInput = appPage.locator('input[name="username"], input#username').first();
  console.log('username fields:', await userInput.count());
  if (await userInput.count()) {
    await userInput.fill('shaziauser1');
    const passInput = appPage.locator('input[name="password"], input#password').first();
    if (await passInput.count()) await passInput.fill('@User12345');
    const submit = appPage.locator('button[type="submit"], input[type="submit"], #kc-login').first();
    if (await submit.count()) {
      await submit.click();
      await appPage.waitForTimeout(7000);
    }
  }

  await appPage.goto('https://app.oriso-dev.site/sessions/consultant/sessionView/session/102318', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await appPage.waitForTimeout(9000);

  const composer = appPage.locator('.textarea__wrapper-send-message').first();
  const composerCount = await composer.count();
  console.log('composerCount:', composerCount);
  if (composerCount) {
    await composer.screenshot({ path: '.tmp-proof/app-composer.png' });
  }
  await appPage.screenshot({ path: '.tmp-proof/app-full.png', fullPage: true });

  await browser.close();
  console.log('done');
})();
