/**
 * Screenshot the chat-stage + session-header stories from a running
 * Storybook (port 6099).
 * Usage: node _shots/shoot.mjs            → _shots/stage-v5/<story>-<viewport>.png
 *        SHOT_DIR=stage-v4 node _shots/shoot.mjs  (older set)
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = join(
	dirname(fileURLToPath(import.meta.url)),
	process.env.SHOT_DIR ?? 'stage-v5'
);
mkdirSync(outDir, { recursive: true });
const base = process.env.SB_URL ?? 'http://localhost:6099';

const viewports = {
	'1280x820': { width: 1280, height: 820 },
	'1440x900': { width: 1440, height: 900 },
	'390x844': { width: 390, height: 844 }
};

const stage = 'templates-consultantsessionstage--';
const shots = [
	[
		'a-supervision-inside-card',
		`${stage}supervision-inside-the-card`,
		['1280x820', '1440x900', '390x844']
	],
	[
		'a2-supervision-system-notice',
		`${stage}supervision-system-notice-at-the-top`,
		['1280x820', '1440x900']
	],
	[
		'b-supervision-second-card',
		`${stage}supervision-as-second-card`,
		['1280x820', '1440x900', '390x844']
	],
	[
		'c-list-snapped-icon-rail',
		`${stage}list-snapped-to-icon-rail`,
		['1280x820', '1440x900', '390x844']
	],
	[
		'd-thread-and-supervision',
		`${stage}thread-and-supervision-open-at-once`,
		['1280x820', '1440x900', '390x844'],
		'open-fab'
	],
	['e1-phone-main-fab', `${stage}phone-main-chat-with-fab`, ['390x844']],
	[
		'g-phone-composer-one-line',
		`${stage}phone-composer-grows-while-typing`,
		['390x844']
	],
	[
		'g-phone-composer-three-lines',
		`${stage}phone-composer-grows-while-typing`,
		['390x844'],
		'type-three-lines'
	],
	[
		'd2-panel-channel-options-open',
		`${stage}thread-and-supervision-open-at-once`,
		['1280x820'],
		'open-panel-options'
	],
	[
		'd2-panel-channel-menu-switch',
		`${stage}panel-channel-menu-switches-channels`,
		['1280x820', '1440x900'],
		'open-panel-options'
	],
	[
		'e3-phone-channel-menu-header',
		`${stage}phone-channel-menu-from-fab-and-header`,
		['390x844'],
		'open-panel-options'
	],
	[
		'e3-phone-channel-menu-fab',
		`${stage}phone-main-chat-with-fab`,
		['390x844'],
		'open-fab'
	],
	[
		'sidepanel-narrow-count',
		'components-session-sidepanel--narrow-header-shows-participant-count',
		['1280x820']
	],
	[
		'e2-phone-secondary-back-fab',
		`${stage}phone-secondary-chat-with-back-fab`,
		['390x844']
	],
	[
		'f-fab-label-topic-vs-person',
		`${stage}fab-label-topic-vs-supervisor-name`,
		['1280x820', '390x844']
	],
	[
		'sidepanel-supervision',
		'components-session-sidepanel--supervision',
		['1280x820']
	],
	['sidepanel-thread', 'components-session-sidepanel--thread', ['1280x820']],
	['sidepanel-phone', 'components-session-sidepanel--phone-390', ['390x844']],
	[
		'fab-menu',
		'components-chat-channelswitcherfab--menu-two-threads-and-supervision',
		['1280x820'],
		'open-fab'
	],
	[
		'fab-single-attention',
		'components-chat-channelswitcherfab--single-supervision-attention',
		['1280x820']
	],
	[
		'header-active-conversation',
		'components-session-sessionheader--active-conversation',
		['1280x820', '1440x900', '390x844']
	],
	[
		'header-participants',
		'components-session-sessionheader--active-conversation-participants',
		['1280x820', '1440x900', '390x844']
	],
	[
		'header-participants-hover',
		'components-session-sessionheader--active-conversation-participants',
		['1280x820'],
		'hover-first-avatar'
	],
	[
		'header-many-participants',
		'components-session-sessionheader--active-conversation-many-participants',
		['1280x820', '390x844']
	],
	[
		'header-group-large',
		'components-session-sessionheader--group-chat-large',
		['1280x820']
	],
	[
		'participant-stack',
		'components-chat-participantavatarstack--three-participants',
		['1280x820']
	],
	[
		'participant-stack-32',
		'components-chat-participantavatarstack--size-32',
		['1280x820']
	],
	[
		'header-many-participants-phone',
		'components-session-sessionheader--active-conversation-many-participants-phone',
		['390x844']
	],
	[
		'handle-panel-start-anchor',
		'components-session-list-resizablehandle--panel-start-anchor',
		['1280x820']
	]
];

const browser = await chromium.launch({ channel: 'chrome' });
const context = await browser.newContext({
	locale: 'de-DE',
	timezoneId: 'Europe/Berlin',
	deviceScaleFactor: 2
});

for (const [name, id, sizes, action] of shots) {
	for (const size of sizes) {
		const page = await context.newPage();
		await page.setViewportSize(viewports[size]);
		await page.goto(`${base}/iframe.html?id=${id}&viewMode=story`, {
			waitUntil: 'networkidle'
		});
		await page.waitForSelector('#storybook-root > *', {
			state: 'attached',
			timeout: 60_000
		});
		await page.waitForTimeout(1200);
		if (action === 'open-fab') {
			const fab = page
				.locator('[data-cy="channel-switcher-fab"]')
				.first();
			if (await fab.count()) {
				await fab.click();
				await page.waitForTimeout(300);
			}
		}
		if (action === 'open-panel-options') {
			await page
				.locator('[data-cy="panel-header-channel-options"]')
				.first()
				.click();
			await page.waitForTimeout(300);
		}
		if (action === 'hover-first-avatar') {
			await page
				.locator('[data-cy="participant-avatar"]')
				.first()
				.hover();
			await page.waitForTimeout(300);
		}
		if (action === 'type-three-lines') {
			await page.click('.textarea__wrapper-send-message .ProseMirror');
			await page.keyboard.type('Zeile eins');
			await page.keyboard.press('Shift+Enter');
			await page.keyboard.type('Zeile zwei');
			await page.keyboard.press('Shift+Enter');
			await page.keyboard.type('Zeile drei');
			await page.waitForTimeout(600);
		}
		const file = join(outDir, `${name}-${size}.png`);
		await page.screenshot({ path: file, fullPage: false });
		console.log(file);
		await page.close();
	}
}

await browser.close();
