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
 *   node scripts/shootCallStages.mjs [outDir]   # default: _shots/call
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

/* `_shots/` is the repo's gitignored evidence scratch dir (AGENTS.md: the
   evidence lives on the pull request, not in git). */
const OUT = process.argv[2] ?? '_shots/call';
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
	['call-stages-einzelgespräch--auf-dem-handy', 'Einzel-handy', 400],
	['call-notizen--leer', 'Notizen-leer', 520],
	['call-notizen--rail', 'Notizen-rail', 520],
	['call-notizen--beschrieben', 'Notizen-beschrieben', 520],
	['call-notizen--neben-der-buehne', 'Notizen-neben-der-Buehne', 1280]
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

/** The notes panel. Only the last of them has a stage next to it. */
const NOTES_STORIES = new Set([
	'Notizen-leer',
	'Notizen-rail',
	'Notizen-beschrieben',
	'Notizen-neben-der-Buehne'
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
	} else if (NOTES_STORIES.has(name)) {
		await page.waitForSelector('[data-testid="gespraechsnotizen"]');
		// The written-in story types its notes through the real controls in a
		// play function, so the pad is empty for a moment after mount.
		if (name === 'Notizen-beschrieben')
			await page.waitForFunction(
				() =>
					document.querySelectorAll('[data-testid="note"]').length ===
					3
			);
		if (name === 'Notizen-neben-der-Buehne')
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

	/*
	 * Ticket 06: "The panel never covers the stage on a 1280 px screen; the
	 * stage reflows." That is a statement about geometry, so it is measured
	 * as geometry — two rectangles that must not intersect. jsdom has no
	 * layout and would have agreed with any CSS at all.
	 */
	if (name === 'Notizen-neben-der-Buehne') {
		const dock = await page.evaluate(() => {
			const panel = document.querySelector(
				'[data-testid="gespraechsnotizen"]'
			);
			// The stage AREA, not the Hain inside it: the area is the space a
			// docked panel can take away, and so it is what "the stage
			// reflows" is about. The Hain is square and takes the smaller of
			// that area's two dimensions.
			const stage = document.querySelector('[data-testid="stage-area"]');
			if (!panel || !stage) return { missing: true };
			const p = panel.getBoundingClientRect();
			const s = stage.getBoundingClientRect();
			const overlap =
				Math.max(
					0,
					Math.min(p.right, s.right) - Math.max(p.left, s.left)
				) *
				Math.max(
					0,
					Math.min(p.bottom, s.bottom) - Math.max(p.top, s.top)
				);
			return {
				overlap: Math.round(overlap),
				panel: Math.round(p.width),
				stage: Math.round(s.width),
				// A panel that floats over the stage would have to be taken
				// out of the flow to do it, so the computed value is part of
				// the claim and not only the resulting rectangle.
				position: getComputedStyle(panel).position
			};
		});
		if (dock.missing) {
			failures.push(`${name}: Panel oder Bühne nicht gefunden`);
		} else {
			process.stdout.write(
				`${'Notizen-Dock'.padEnd(22)} Fläche ${dock.stage}px | Panel ${dock.panel}px | Überlappung ${dock.overlap}px² | position: ${dock.position}\n`
			);
			if (dock.overlap > 0)
				failures.push(
					`${name}: Panel verdeckt die Bühne (${dock.overlap}px²)`
				);
			if (dock.position !== 'static')
				failures.push(
					`${name}: Panel ist aus dem Fluss genommen (position: ${dock.position})`
				);

			// "...the stage reflows." The other half of the sentence, and the
			// half a static panel does not prove on its own: collapse the
			// panel to its rail and the stage area must actually take the
			// freed width, not sit at whatever size it was given.
			await page.click('[aria-label="Notizen einklappen"]');
			await page
				.waitForFunction(
					(before) => {
						const area = document.querySelector(
							'[data-testid="stage-area"]'
						);
						return (
							!!area &&
							area.getBoundingClientRect().width > before + 1
						);
					},
					dock.stage,
					{ timeout: 4000 }
				)
				.catch(() => {
					failures.push(
						`${name}: Bühnenfläche wächst nicht, wenn das Panel einklappt (blieb bei ${dock.stage}px)`
					);
				});
			const grown = await page.evaluate(() => {
				const px = (sel) =>
					Math.round(
						document.querySelector(sel).getBoundingClientRect()
							.width
					);
				return {
					area: px('[data-testid="stage-area"]'),
					hain: px('[data-testid="hain-stage"]')
				};
			});
			process.stdout.write(
				`${'Notizen-Dock-Rail'.padEnd(22)} Fläche ${dock.stage}px → ${grown.area}px | Hain ${grown.hain}px (quadratisch, hier höhenbegrenzt)\n`
			);
			await page.screenshot({ path: `${OUT}/${name}-eingeklappt.png` });
		}
	}

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
