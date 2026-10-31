/**
 * FE#1435: the "Neue Anfrage" row (tab Anfragen) rings out of the box. Every
 * account already stored its settings with the old silent default, so a
 * stored "Kein Ton" from before this change is upgraded once; a tone the
 * counsellor picks after it (including "Kein Ton") is kept.
 */
import { describe, expect, it } from 'vite-plus/test';
import {
	DEFAULT_NOTIFICATION_CONFIG,
	setKindField
} from './notificationConfig';
import {
	DEFAULT_NOTIFICATION_SETTINGS,
	mergeNotificationSettings,
	NOTIFICATION_SETTINGS_REVISION,
	parseNotificationSettings
} from './model';

const storedBefore = (
	requestsNew: Record<string, unknown>,
	extra: Record<string, unknown> = {}
) => ({
	globalMute: false,
	notificationConfig: {
		requests: { new: { banner: 'temporary', email: true, ...requestsNew } }
	},
	...extra
});

describe('new-enquiry tone default (FE#1435)', () => {
	it('rings the "Neue Anfrage" row by default, and only that row', () => {
		expect(DEFAULT_NOTIFICATION_CONFIG.requests.new.sound).toBe('ton-1');
		expect(DEFAULT_NOTIFICATION_CONFIG.requests.standard.sound).toBe(
			'none'
		);
		expect(DEFAULT_NOTIFICATION_CONFIG.conversations.new.sound).toBe(
			'none'
		);
		expect(DEFAULT_NOTIFICATION_SETTINGS.notificationConfigRevision).toBe(
			NOTIFICATION_SETTINGS_REVISION
		);
	});

	it('upgrades a silent row stored before this change to the tone, once', () => {
		const parsed = parseNotificationSettings(
			storedBefore({ sound: 'none', volume: 0.75 })
		);
		expect(parsed.notificationConfig.requests.new.sound).toBe('ton-1');
		// Everything else the counsellor stored stays as it was.
		expect(parsed.notificationConfig.requests.new.volume).toBe(0.75);
		expect(parsed.notificationConfigRevision).toBe(
			NOTIFICATION_SETTINGS_REVISION
		);
	});

	it('keeps a tone the counsellor had already chosen', () => {
		const parsed = parseNotificationSettings(
			storedBefore({ sound: 'ton-7' })
		);
		expect(parsed.notificationConfig.requests.new.sound).toBe('ton-7');
	});

	it('keeps "Kein Ton" chosen after the change', () => {
		const migrated = parseNotificationSettings(
			storedBefore({ sound: 'none' })
		);
		const silenced = mergeNotificationSettings(migrated, {
			notificationConfig: setKindField(
				migrated.notificationConfig,
				'requests',
				'new',
				'sound',
				'none'
			)
		});
		// What the store writes back carries the revision …
		const roundTrip = parseNotificationSettings(
			JSON.parse(JSON.stringify(silenced))
		);
		// … so the deliberate choice survives the next load.
		expect(roundTrip.notificationConfig.requests.new.sound).toBe('none');
	});

	it('never touches the pop-up switch of the row', () => {
		const parsed = parseNotificationSettings(
			storedBefore({ sound: 'none', banner: 'off' })
		);
		expect(parsed.notificationConfig.requests.new.banner).toBe('off');
	});
});
