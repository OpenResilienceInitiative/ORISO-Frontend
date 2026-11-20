/**
 * FE#779: the feed announcement path in NotificationsProvider is the only
 * caller of `sendNotification`, so no event can raise a second OS banner from
 * a legacy call site (WebsocketHandler, useBrowserNotification). Other ways to
 * raise an OS notification (`new Notification`, `window.Notification`,
 * `showNotification`, an aliased import) are caught too.
 */
import { readFileSync } from 'node:fs';
import { globSync } from 'glob';
import { describe, expect, it } from 'vite-plus/test';

const withoutComments = (code: string) =>
	code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

const SEND = /\bsendNotification\b/;
const CONSTRUCT =
	/\bnew\s+(?:(?:window|globalThis|self)\s*\.\s*)?Notification\b/;
const SERVICE_WORKER = /\.\s*showNotification\s*\(/;
const WINDOW_NOTIFICATION =
	/\b(?:window|globalThis|self)\s*(?:\.\s*Notification\b|\[\s*['"]Notification['"]\s*\])/;

describe('the scanners', () => {
	it.each([
		[SEND, "import { sendNotification as notify } from './x';"],
		[SEND, 'sendNotification("t");'],
		[CONSTRUCT, 'new Notification("t");'],
		[CONSTRUCT, 'new window.Notification("t");'],
		[CONSTRUCT, 'new globalThis . Notification("t");'],
		[SERVICE_WORKER, 'registration.showNotification("t");'],
		[WINDOW_NOTIFICATION, 'const N = window.Notification;'],
		[WINDOW_NOTIFICATION, "new window['Notification']('t');"]
	])('%s matches %s', (pattern, code) => {
		expect(pattern.test(withoutComments(code))).toBe(true);
	});

	it('ignores comments', () => {
		expect(
			SEND.test(
				withoutComments(
					'/** `sendNotification` shows… */\n// sendNotification'
				)
			)
		).toBe(false);
	});
});

const sources = globSync('src/**/*.{ts,tsx}', {
	ignore: ['**/*.test.*', '**/*.stories.*']
});
const code = (file: string) => withoutComments(readFileSync(file, 'utf8'));

it('lets only the feed announcement path call sendNotification', () => {
	const callers = sources.filter((file) => SEND.test(code(file)));
	expect(callers.sort()).toEqual([
		'src/globalState/provider/NotificationsProvider.tsx',
		// `requestPermissions` confirms a fresh grant; it is not an event banner.
		'src/utils/notificationHelpers.ts'
	]);
});

it('constructs OS notifications in one place only', () => {
	const where = (pattern: RegExp) =>
		sources.filter((file) => pattern.test(code(file)));
	expect(where(CONSTRUCT)).toEqual(['src/utils/notificationHelpers.ts']);
	expect(where(SERVICE_WORKER)).toEqual([]);
	expect(where(WINDOW_NOTIFICATION)).toEqual([]);
});
