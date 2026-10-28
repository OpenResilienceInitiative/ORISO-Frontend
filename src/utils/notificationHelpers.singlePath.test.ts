/**
 * FE#779: the feed announcement path in NotificationsProvider is the only
 * caller of `sendNotification`, so no event can raise a second OS banner from
 * a legacy call site (WebsocketHandler, useBrowserNotification).
 */
import { readFileSync } from 'node:fs';
import { globSync } from 'glob';
import { expect, it } from 'vite-plus/test';

const sources = globSync('src/**/*.{ts,tsx}', {
	ignore: ['**/*.test.*', '**/*.stories.*']
});

it('lets only the feed announcement path call sendNotification', () => {
	const callers = sources.filter((file) =>
		/\bsendNotification\(/.test(readFileSync(file, 'utf8'))
	);
	expect(callers.sort()).toEqual([
		'src/globalState/provider/NotificationsProvider.tsx',
		// `requestPermissions` confirms a fresh grant; it is not an event banner.
		'src/utils/notificationHelpers.ts'
	]);
});

it('constructs OS notifications in one place only', () => {
	const constructors = sources.filter((file) =>
		/new Notification\(/.test(readFileSync(file, 'utf8'))
	);
	expect(constructors).toEqual(['src/utils/notificationHelpers.ts']);
});
