import { test } from '@playwright/test';

test('capture figma and app composer', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });

  const figma = await context.newPage();
  await figma.goto('https://www.figma.com/design/Y7PJA0yRXm8R8i49kFnnvP/ORISO?node-id=84-14745&t=gfdDHfZuUusXoUZQ-0', { waitUntil: 'domcontentloaded' });
  await figma.waitForTimeout(8000);
  await figma.screenshot({ path: '/tmp/figma-node-full.png', fullPage: true });

  const app = await context.newPage();
  await app.goto('https://app.oriso-dev.site', { waitUntil: 'domcontentloaded' });
  await app.waitForTimeout(3000);

  const user = app.locator('input[name="username"], input#username').first();
  if (await user.count()) {
    await user.fill('shaziauser1');
    const pass = app.locator('input[name="password"], input#password').first();
    if (await pass.count()) await pass.fill('@User12345');
    const submit = app.locator('#kc-login, button[type="submit"], input[type="submit"]').first();
    if (await submit.count()) {
      await submit.click();
      await app.waitForTimeout(7000);
    }
  }

  await app.goto('https://app.oriso-dev.site/sessions/consultant/sessionView/session/102318', { waitUntil: 'domcontentloaded' });
  await app.waitForTimeout(9000);

  const composer = app.locator('.textarea__wrapper-send-message').first();
  if (await composer.count()) {
    await composer.screenshot({ path: '/tmp/app-composer.png' });
  }
  await app.screenshot({ path: '/tmp/app-full.png', fullPage: true });
});
