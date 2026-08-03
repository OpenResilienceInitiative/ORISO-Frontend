import { describe, expect, it } from 'vitest';
import { isNotificationActiveViewRoute } from './notificationActiveView';

describe('isNotificationActiveViewRoute', () => {
	it.each([
		'/sessions/consultant/sessionView/!room:matrix.localhost/13',
		'/sessions/consultant/sessionPreview/session/13',
		'/sessions/user/view/!room:matrix.localhost/13'
	])(
		'keeps active-view suppression on a visible conversation route %s',
		(path) => {
			expect(isNotificationActiveViewRoute(path)).toBe(true);
		}
	);

	it.each([
		'/notifications',
		'/profile/einstellungen/sicherheit',
		'/sessions/consultant/sessionView',
		'/sessions/consultant/sessionView/',
		'/sessions/consultant/sessionView/session/13/userProfile'
	])(
		'deactivates notification suppression away from a conversation %s',
		(path) => {
			expect(isNotificationActiveViewRoute(path)).toBe(false);
		}
	);
});
