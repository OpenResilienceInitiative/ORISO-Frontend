/**
 * Photograph the call stages in a real browser, and fail on what jsdom cannot
 * see.
 *
 * jsdom has no layout, so it cannot tell you that a name is painted over by a
 * neighbouring shape, that a capsule hangs past the form it belongs to, or
 * that a pseudonym has lost the number that identifies it. Every one of those
 * has happened here, and every one was found in a picture.
 *
 *   npm run storybook           # in another shell
 *   node scripts/shootCallStages.mjs [outDir]
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const OUT = process.argv[2] ?? 'screenshots/call';
const STORIES = [
	['call-stages-hain--ruhig', 'Hain-9-ruhig', 900],
	['call-stages-hain--jemand-spricht', 'Hain-9-spricht', 900],
	['call-stages-hain--mit-status', 'Hain-Status', 900],
	['call-stages-hain--klein', 'Hain-4', 900],
	['call-stages-hain--zu-zweit', 'Hain-2', 900],
	['call-stages-hain--auf-dem-handy', 'Hain-Handy', 420],
	['call-stages-hain--mit-atmosphaere', 'Hain-Atmosphaere', 900],
	['call-stages-hain--dunkle-atmosphaere', 'Hain-Atmosphaere-dunkel', 900],
	['call-atmosphere--alle-welten', 'Atmosphaeren-alle', 980],
	['call-atmosphere--buehne', 'Atmosphaere-gross', 960]
];

/** The atmosphere stories carry no participants; only the stages do. */
const STAGE_STORIES = new Set([
	'Hain-9-ruhig',
	'Hain-9-spricht',
	'Hain-Status',
	'Hain-4',
	'Hain-2',
	'Hain-Handy',
	'Hain-Atmosphaere',
	'Hain-Atmosphaere-dunkel'
]);

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({
	executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium'
});
const failures = [];

for (const [id, name, width] of STORIES) {
	const ctx = await browser.newContext({
		viewport: { width, height: 820 },
		deviceScaleFactor: 2,
		locale: 'de-DE'
	});
	const page = await ctx.newPage();
	page.on('pageerror', (e) => failures.push(`${name}: ${e}`));
	page.on('console', (m) => {
		if (m.type() === 'error') failures.push(`${name}: ${m.text()}`);
	});

	await page.goto(
		`http://127.0.0.1:6006/iframe.html?id=${id}&viewMode=story`,
		{ waitUntil: 'networkidle' }
	);
	if (STAGE_STORIES.has(name)) {
		await page.waitForSelector('[data-testid="hain-stage"]');
		await page.waitForFunction(
			() =>
				document.querySelectorAll('[data-testid="participant"] svg')
					.length > 0
		);
	} else {
		await page.waitForSelector('oriso-pond');
	}
	// The backdrop needs a moment of its slow clock to be worth looking at.
	await page.waitForTimeout(1200);
	await page.screenshot({ path: `${OUT}/${name}.png` });

	const report = await page.evaluate(() => {
		const pills = [
			...document.querySelectorAll('[data-testid="name-pill"]')
		];
		// The capsule is pointer-events:none so it cannot swallow a click meant
		// for the tile. Switch that off for the hit test, or elementFromPoint
		// reports the animal underneath and every name looks covered.
		const wrappers = pills.map((p) => p.parentElement);
		wrappers.forEach((w) => {
			w.dataset.pe = w.style.pointerEvents;
			w.style.pointerEvents = 'auto';
		});

		const covered = [];
		const overhanging = [];
		const truncated = [];
		for (const pill of pills) {
			const slot = pill.closest('[data-testid="participant"]');
			const pb = pill.getBoundingClientRect();
			const sb = slot.getBoundingClientRect();
			const label = pill.textContent.trim().slice(0, 24);

			const top = document.elementFromPoint(
				pb.left + pb.width / 2,
				pb.top + pb.height / 2
			);
			if (top && !pill.contains(top) && top !== pill) covered.push(label);
			if (pb.width > sb.width + 1) overhanging.push(label);

			const text = pill.querySelector('[data-testid="name-pill-text"]');
			if (text && text.scrollWidth > text.clientWidth + 1)
				truncated.push(text.textContent.trim());
		}

		wrappers.forEach((w) => {
			w.style.pointerEvents = w.dataset.pe;
		});
		return { count: pills.length, covered, overhanging, truncated };
	});

	process.stdout.write(
		`${name.padEnd(16)} ${report.count} Pillen | verdeckt ${report.covered.length} | ragt über die Form ${report.overhanging.length} | gekürzt ${report.truncated.length}${report.truncated.length ? ': ' + report.truncated.join(' · ') : ''}\n`
	);
	if (report.covered.length)
		failures.push(
			`${name}: verdeckte Namen — ${report.covered.join(', ')}`
		);
	if (report.overhanging.length)
		failures.push(
			`${name}: Pille breiter als ihre Form — ${report.overhanging.join(', ')}`
		);
	await ctx.close();
}

await browser.close();
process.stdout.write(
	failures.length
		? `\nBEFUNDE:\n${failures.map((f) => `  - ${f}`).join('\n')}\n`
		: '\nsauber\n'
);
process.exit(failures.length ? 1 : 0);
