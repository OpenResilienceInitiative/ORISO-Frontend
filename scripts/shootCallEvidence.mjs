/**
 * Photograph the call surfaces of ORISO-Frontend#780 for the pull request.
 *
 * AGENTS.md: "Any change a reviewer could look at — UI, layout, copy, icons,
 * states — ships with screenshots, not just a prose claim. Capture them from
 * Storybook when the changed components have stories." The plates land in
 * `docs/storybook/issue-780-call-v2-stage-and-timeline/` and are committed.
 *
 * `shootCallStages.mjs` is the other half of this: it photographs all 38
 * stage plates AND measures them (name pills, contrast, overlap), and it
 * fails the run on what it finds. This script only takes the pictures the
 * pull request embeds, at scale 1 so they are small enough to live in git.
 *
 *   npm run storybook                                   # in another shell
 *   CHROMIUM_PATH=/opt/pw-browsers/chromium \
 *     node scripts/shootCallEvidence.mjs <outDir> [namePrefix]
 *
 * The `05-before-*` plate needs the PREVIOUS version of the component:
 *
 *   git show origin/dev:src/components/message/Appointment.tsx \
 *     > src/components/message/Appointment.tsx
 *   node scripts/shootCallEvidence.mjs <outDir> 05-before
 *   git checkout HEAD -- src/components/message/Appointment.tsx
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const OUT = process.argv[2] ?? '_shots/evidence';
const ONLY = process.argv[3];

/**
 * [storyId, file, width, waitFor, mustContain]
 *
 * `mustContain` is checked against the rendered text, so a blank frame or a
 * "story not found" page cannot be committed as evidence of anything.
 */
const PLATES = [
	// The timeline card, against the surface it replaces. The "before" never
	// appeared in the app — no producer ever sent its message, which is what
	// #780 is about — so it is the designed predecessor, not a screenshot of
	// a working feature.
	[
		'chat-call-event-in-the-timeline--running-joinable',
		'01-before-call-event-running',
		760,
		null,
		'Videokonferenz'
	],
	[
		'components-chat-calltimelinemessage--running',
		'01-after-timeline-running',
		760,
		null,
		'Beitreten'
	],
	[
		'chat-call-event-in-the-timeline--ended-log',
		'02-before-call-event-ended',
		760,
		null,
		'Videokonferenz'
	],
	[
		'components-chat-calltimelinemessage--ended',
		'02-after-timeline-ended',
		760,
		null,
		'eendet'
	],
	[
		'components-chat-calltimelinemessage--missed',
		'03-after-timeline-missed',
		760,
		null,
		'erpasst'
	],
	[
		'components-chat-messageitem--ended-call',
		'04-after-timeline-in-the-message-list',
		900,
		null,
		'Teilgenommen'
	],
	// The appointment card's hour, which was shifted twice by the old
	// conversion. Shot in Europe/Berlin, where 09:00Z is 11:00.
	[
		'components-chat-appointment--set',
		'05-before-appointment-time',
		760,
		null,
		'Beratungstermin'
	],
	[
		'components-chat-appointment--set',
		'05-after-appointment-time',
		760,
		null,
		'11:00'
	],
	/*
	 * The stage's own plates are not shot here any more.
	 *
	 * 06 to 09 and 12 came from the host's copy of the Hain, the Felder, the
	 * Einzelgespräch, the atmospheres and the view switcher. That copy is
	 * gone — the call is drawn by ORISO-ElementCall, which is where those
	 * arrangements are photographed now (`scripts/shootOrisoStage.mjs` and
	 * `docs/evidence/` there). The plates themselves stay committed under
	 * `docs/storybook/issue-780-call-v2-stage-and-timeline/`, with a line in
	 * its README saying where they came from; what this script can still
	 * reproduce is what this repository still renders.
	 */
	[
		'call-notizen--neben-der-buehne',
		'10-after-notizen-neben-der-buehne',
		1280,
		'[data-testid="gespraechsnotizen"]',
		'Gesprächsnotizen'
	],
	[
		'call-notizen--beschrieben',
		'11-after-notizen-beschrieben',
		520,
		'[data-testid="note"]',
		null
	]
];

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch(
	process.env.CHROMIUM_PATH
		? { executablePath: process.env.CHROMIUM_PATH }
		: {}
);
const failures = [];

for (const [id, file, width, waitFor, mustContain] of PLATES) {
	if (ONLY && !file.startsWith(ONLY)) continue;
	const ctx = await browser.newContext({
		viewport: { width, height: 820 },
		deviceScaleFactor: 1,
		locale: 'de-DE',
		timezoneId: 'Europe/Berlin'
	});
	const page = await ctx.newPage();
	page.on('pageerror', (e) => failures.push(`${file}: ${e}`));
	await page.goto(
		`http://127.0.0.1:6006/iframe.html?id=${id}&viewMode=story`,
		{ waitUntil: 'networkidle' }
	);
	/*
	 * `networkidle` is not "the story is on screen".
	 *
	 * Storybook's dev server compiles a story file the first time it is
	 * asked for, and the request that triggers that compile finishes long
	 * before the module arrives — so the first plate of every file came back
	 * as a photograph of the spinner. The wait is therefore on the rendered
	 * thing: the root has children and the loader is gone.
	 */
	await page.waitForFunction(
		() => {
			const root = document.querySelector('#storybook-root');
			// NOT "the loader is gone": `.sb-preparing-story` is a wrapper
			// that is always in the document, so asking for its absence
			// waits for ever.
			return !!root && root.children.length > 0;
		},
		undefined,
		{ timeout: 60000 }
	);
	if (waitFor) await page.waitForSelector(waitFor, { timeout: 30000 });
	if (mustContain)
		await page
			.getByText(mustContain, { exact: false })
			.first()
			.waitFor({ timeout: 30000 });
	// The shapes animate in, and the atmosphere draws on a canvas.
	await page.waitForTimeout(1200);
	const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
	if (mustContain && !text.includes(mustContain))
		failures.push(`${file}: expected ${mustContain} in the plate`);
	const box = await page.locator('#storybook-root').first().boundingBox();
	const height = box ? Math.ceil(box.y + box.height + 8) : 0;
	await page.screenshot({
		path: `${OUT}/${file}.png`,
		clip:
			height > 40 && height < 820
				? { x: 0, y: 0, width, height }
				: undefined
	});
	console.log(`${file.padEnd(38)} ${text.slice(0, 90)}`);
	await ctx.close();
}

await browser.close();
if (failures.length) {
	console.error(failures.join('\n'));
	process.exit(1);
}
console.log('sauber');
