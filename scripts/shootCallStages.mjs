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
	['call-atmosphere--buehne', 'Atmosphaere-gross', 960],
	['call-stages-felder--zu-zweit', 'Felder-2', 960],
	['call-stages-felder--vier-ruhig', 'Felder-4-ruhig', 960],
	['call-stages-felder--vier-mit-sprecher', 'Felder-4-spricht', 960],
	['call-stages-felder--acht', 'Felder-8', 960],
	['call-stages-felder--neun-scrollt', 'Felder-9-scrollt', 960],
	['call-stages-felder--zwanzig-mit-zwei-sprechern', 'Felder-20', 960],
	['call-stages-felder--mit-atmosphaere', 'Felder-Atmosphaere', 960],
	['call-stages-felder--auf-dem-handy', 'Felder-Handy', 420],
	['call-stages-einzelgespräch--stille', 'Einzel-still', 700],
	[
		'call-stages-einzelgespräch--ratsuchende-spricht',
		'Einzel-ratsuchend',
		700
	],
	['call-stages-einzelgespräch--beraterin-spricht', 'Einzel-beraterin', 700],
	['call-stages-einzelgespräch--mit-status', 'Einzel-status', 700],
	['call-stages-einzelgespräch--mit-atmosphaere', 'Einzel-atmosphaere', 700],
	['call-stages-einzelgespräch--auf-dem-handy', 'Einzel-handy', 400]
];

/** The two-person circle has halves rather than participants or fields. */
const PAIR_STORIES = new Set([
	'Einzel-still',
	'Einzel-ratsuchend',
	'Einzel-beraterin',
	'Einzel-status',
	'Einzel-atmosphaere',
	'Einzel-handy'
]);

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

/** Felder draws fields rather than packed shapes, so it waits on its own. */
const FIELD_STORIES = new Set([
	'Felder-2',
	'Felder-4-ruhig',
	'Felder-4-spricht',
	'Felder-8',
	'Felder-9-scrollt',
	'Felder-20',
	'Felder-Atmosphaere',
	'Felder-Handy'
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
	if (PAIR_STORIES.has(name)) {
		await page.waitForSelector('[data-testid="einzelgespraech-stage"]');
		await page.waitForFunction(
			() =>
				document.querySelectorAll('[data-testid="animal"] svg').length >
				0
		);
	} else if (FIELD_STORIES.has(name)) {
		await page.waitForSelector('[data-testid="felder-stage"]');
		await page.waitForFunction(
			() =>
				document.querySelectorAll('[data-testid="field"] svg').length >
				0
		);
	} else if (STAGE_STORIES.has(name)) {
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

		// In a scrolling stage the tiles below the fold are clipped, and
		// elementFromPoint answers for the viewport only. Something scrolled
		// out of sight is not covered, so it is skipped rather than reported
		// — the first run called three of twenty "covered" for exactly this.
		const stage = document.querySelector(
			'[data-testid="hain-stage"], [data-testid="felder-stage"], [data-testid="einzelgespraech-stage"]'
		);
		// The atmosphere stories are backdrops with nobody on them.
		if (!stage)
			return {
				count: 0,
				covered: [],
				overhanging: [],
				truncated: [],
				offscreen: 0
			};
		const visible = stage.getBoundingClientRect();
		const inView = (b) =>
			b.top >= visible.top - 1 &&
			b.bottom <= visible.bottom + 1 &&
			b.left >= visible.left - 1 &&
			b.right <= visible.right + 1;

		const covered = [];
		const overhanging = [];
		const truncated = [];
		let offscreen = 0;
		for (const pill of pills) {
			// Hain wraps a participant, Felder wraps a field. Either is "the
			// box this capsule belongs to"; a capsule wider than its own box
			// hangs over the neighbours in both.
			const slot = pill.closest(
				'[data-testid="participant"], [data-testid="field"], [data-testid="einzelgespraech-stage"]'
			);
			if (!slot) continue;
			const pb = pill.getBoundingClientRect();
			const sb = slot.getBoundingClientRect();
			const label = pill.textContent.trim().slice(0, 24);

			if (!inView(pb)) {
				offscreen += 1;
			} else {
				const top = document.elementFromPoint(
					pb.left + pb.width / 2,
					pb.top + pb.height / 2
				);
				if (top && !pill.contains(top) && top !== pill)
					covered.push(label);
			}
			if (pb.width > sb.width + 1) overhanging.push(label);

			const text = pill.querySelector('[data-testid="name-pill-text"]');
			if (text && text.scrollWidth > text.clientWidth + 1)
				truncated.push(text.textContent.trim());
		}

		wrappers.forEach((w) => {
			w.style.pointerEvents = w.dataset.pe;
		});
		return {
			count: pills.length,
			covered,
			overhanging,
			truncated,
			offscreen
		};
	});

	process.stdout.write(
		`${name.padEnd(22)} ${report.count} Pillen | verdeckt ${report.covered.length} | ragt über ${report.overhanging.length} | gekürzt ${report.truncated.length} | weggescrollt ${report.offscreen}${report.truncated.length ? ' · ' + report.truncated.join(' · ') : ''}\n`
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
