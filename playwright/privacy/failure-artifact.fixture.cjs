const { test, expect } = require(process.env.ORISO_PRIVACY_TEST_MODULE);
const fs = require('node:fs/promises');

test('synthetic failure artifact privacy canary', async ({ page }, info) => {
	await page.setContent(`<!doctype html><body style="margin:0;background:white">
		<div style="position:absolute;left:0;top:0;width:20px;height:20px;background:rgb(0,0,255)"></div>
		<code id="synthetic-secret" style="position:absolute;left:40px;top:70px;width:560px;height:80px;background:white;color:black;font-size:18px;overflow-wrap:anywhere">${process.env.ORISO_PRIVACY_CANARY}</code>
	</body>`);
	const secret = page.locator('#synthetic-secret');
	await expect(secret).toBeVisible();
	const mask = await secret.boundingBox();
	await page.screenshot({
		path: info.outputPath('masked-failure.png'),
		mask: [secret],
		maskColor: '#FF00FF',
		animations: 'disabled'
	});
	await fs.writeFile(
		info.outputPath('sanitized-failure.json'),
		JSON.stringify({
			kind: 'synthetic-failure',
			mask,
			viewport: { width: 640, height: 480 }
		})
	);
	// Deliberately fail without assertion values, DOM content or credentials.
	expect(false, 'Intentional synthetic failure').toBe(true);
});
