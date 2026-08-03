// Render every Chat + Carimat story to a PNG so the review sheet is static
// images instead of 121 live Storybook previews. Not part of the app build.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const STATIC = path.join(ROOT, 'storybook-static');
const OUT = path.join(STATIC, 'shots');
const BASE = 'http://localhost:6017';

const index = JSON.parse(
	fs.readFileSync(path.join(STATIC, 'index.json'), 'utf8')
);
const entries = Object.entries(index.entries)
	.filter(
		([id]) =>
			id.startsWith('components-chat-') ||
			id.startsWith('components-dialog-')
	)
	.sort(([a], [b]) => a.localeCompare(b));

// One resolver for the viewport width, so a story that names a width actually
// renders at it. The 375px consent-card story reproduces an overflow that does
// not occur at 390px, so rendering it at 390 would have quietly hidden the very
// thing it exists to show.
const viewportWidth = (id, name) =>
	/375/.test(id + name) ? 375 : /mobile|390|compact/i.test(name) ? 390 : 760;
// Animated stories need time to settle; the typewriter runs char-by-char.
const settleMs = (id, name) =>
	/botmessageanimation|staged|typewriter|reveal/i.test(id + name)
		? 6000
		: /cards--(choose-display-name|privacy-notice)$/.test(id)
			? 5000
			: 900;

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const results = [];
let n = 0;

for (const [id, entry] of entries) {
	const width = viewportWidth(id, entry.name);
	const mob = width <= 390;
	const page = await browser.newPage({
		viewport: { width, height: 900 },
		deviceScaleFactor: 2
	});
	let status = 'ok';
	// A story can navigate and render yet still throw at runtime. Without this
	// the run reports "0 problems" while the screenshot shows a broken card.
	let pageError = null;
	page.on('pageerror', (err) => {
		pageError = err?.message?.split('\n')[0]?.slice(0, 90) ?? 'unknown';
	});
	try {
		await page.goto(`${BASE}/iframe.html?id=${id}&viewMode=story`, {
			waitUntil: 'load',
			timeout: 30000
		});
		await page.waitForSelector('#storybook-root', { timeout: 15000 });
		await page.waitForTimeout(settleMs(id, entry.name));

		const info = await page.evaluate(() => {
			const r = document.getElementById('storybook-root');
			const t = (r?.innerText || '').trim();
			return {
				empty: !r || r.children.length === 0,
				needsData: !!document.querySelector('[data-sb-needs-data]'),
				height: Math.max(r?.scrollHeight || 0, 40),
				textLen: t.length
			};
		});
		if (pageError) status = 'PAGEERROR: ' + pageError;
		else if (info.needsData) status = 'needs-data';
		else if (info.empty) status = 'EMPTY';

		await page.setViewportSize({
			width,
			height: Math.min(Math.max(info.height + 32, 80), 1400)
		});
		await page.waitForTimeout(120);
		await page.screenshot({ path: path.join(OUT, `${id}.png`) });
		results.push({
			id,
			title: entry.title,
			name: entry.name,
			mob,
			status,
			h: info.height,
			textLen: info.textLen
		});
	} catch (e) {
		status = 'ERROR: ' + e.message.split('\n')[0].slice(0, 90);
		results.push({
			id,
			title: entry.title,
			name: entry.name,
			mob,
			status,
			h: 0,
			textLen: 0
		});
	}
	await page.close();
	n++;
	if (n % 20 === 0) console.log(`  ${n}/${entries.length}`);
}

await browser.close();
fs.writeFileSync(
	path.join(OUT, 'results.json'),
	JSON.stringify(results, null, 1)
);

const bad = results.filter((r) => r.status !== 'ok');
console.log(`rendered ${results.length} stories`);
console.log(`problems: ${bad.length}`);
for (const b of bad) console.log(`  [${b.status}] ${b.title} :: ${b.name}`);
