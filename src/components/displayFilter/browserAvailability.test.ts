import { describe, expect, it } from 'vitest';
import { DEFAULT_NOTIFICATION_SETTINGS } from '../../utils/notificationSettings/model';
import { browserPopupsOff } from './browserAvailability';

const settings = (
	enabled: boolean,
	conversationsBanner: 'off' | 'temporary' = 'temporary'
) => {
	const config = structuredClone(
		DEFAULT_NOTIFICATION_SETTINGS.notificationConfig
	);
	Object.values(config.conversations).forEach((kind) => {
		kind.banner = conversationsBanner;
	});
	return {
		...DEFAULT_NOTIFICATION_SETTINGS,
		browserNotifications: { enabled },
		notificationConfig: config
	};
};

describe('browserPopupsOff (Browser column gate)', () => {
	it('is off while the cross-device master switch is off', () => {
		expect(browserPopupsOff('sessions', settings(false), true, true)).toBe(
			true
		);
		expect(browserPopupsOff('sessions', settings(true), true, false)).toBe(
			false
		);
	});

	it('follows the legacy switch while the legacy panel is routed', () => {
		expect(browserPopupsOff('requests', settings(false), false, true)).toBe(
			false
		);
		expect(browserPopupsOff('requests', settings(true), false, false)).toBe(
			true
		);
	});

	it("is off when every banner of the section's area is off", () => {
		expect(
			browserPopupsOff('sessions', settings(true, 'off'), true, true)
		).toBe(true);
		// Anfragen use their own area; Gespräche' banners do not gate them.
		expect(
			browserPopupsOff('requests', settings(true, 'off'), true, true)
		).toBe(false);
	});

	it('does not gate the Zeitstrahl (no Browser column)', () => {
		expect(browserPopupsOff('timeline', settings(false), true, false)).toBe(
			false
		);
	});
});
