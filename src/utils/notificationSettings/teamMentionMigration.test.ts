/**
 * FE#1211: an @-mention in an enquiry's team discussion used to follow
 * Gespräche → Erwähnung and now follows Anfragen → Erwähnung. Stored configs
 * already hold a default Anfragen row that never fired, so the counsellor's
 * Gespräche choice carries over once; a choice made afterwards is kept.
 */
import { describe, expect, it } from 'vite-plus/test';
import { setKindField, soundSettingForEvent } from './notificationConfig';
import {
	mergeNotificationSettings,
	NOTIFICATION_SETTINGS_REVISION,
	parseNotificationSettings
} from './model';

const chosen = { banner: 'off', sound: 'ton-7', email: false, volume: 0.75 };
const untouchedDefault = {
	banner: 'temporary',
	sound: 'ton-2',
	email: false,
	volume: 1
};

const storedBefore = (revision?: number) => ({
	globalMute: false,
	notificationConfig: {
		requests: { mention: untouchedDefault },
		conversations: { mention: chosen }
	},
	...(revision === undefined ? {} : { notificationConfigRevision: revision })
});

const teamMention = (settings: ReturnType<typeof parseNotificationSettings>) =>
	soundSettingForEvent(
		settings.notificationConfig,
		'messages',
		'team.discussion.new',
		true
	);

describe('team-discussion mention settings move to Anfragen (FE#1211)', () => {
	it.each([
		['before any revision', undefined],
		['at revision 1', 1]
	])('carries the Gespräche mention choice over %s', (_label, revision) => {
		const parsed = parseNotificationSettings(storedBefore(revision));

		expect(teamMention(parsed)).toEqual(chosen);
		// Ordinary chat mentions keep their own row.
		expect(parsed.notificationConfig.conversations.mention).toEqual(chosen);
		expect(parsed.notificationConfigRevision).toBe(
			NOTIFICATION_SETTINGS_REVISION
		);
	});

	it('keeps an Anfragen mention choice made after the move', () => {
		const migrated = parseNotificationSettings(storedBefore());
		const changed = mergeNotificationSettings(migrated, {
			notificationConfig: setKindField(
				migrated.notificationConfig,
				'requests',
				'mention',
				'banner',
				'persistent'
			)
		});
		const roundTrip = parseNotificationSettings(
			JSON.parse(JSON.stringify(changed))
		);

		expect(teamMention(roundTrip).banner).toBe('persistent');
	});
});
