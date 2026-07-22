import { describe, expect, it } from 'vitest';
import {
	areaForFamily,
	NEVER_NOTIFY_FAMILIES,
	clampVolume,
	DEFAULT_NOTIFICATION_CONFIG,
	DISABLED_AREAS,
	kindForEvent,
	parseNotificationConfig,
	setKindField,
	soundSettingForEvent
} from './notificationConfig';

describe('notificationConfig', () => {
	it('defaults: sounds off, email on for new/standard and off for mention', () => {
		const r = DEFAULT_NOTIFICATION_CONFIG.requests;
		expect(r.new.sound).toBe('none');
		expect(r.new.email).toBe(true);
		expect(r.standard.email).toBe(true);
		expect(r.mention.email).toBe(false);
		expect(r.new.volume).toBe(0.5);
	});

	it('no area is disabled any more (Zeitkritisch is live)', () => {
		expect(DISABLED_AREAS).toHaveLength(0);
	});

	it('parse keeps valid stored values and fills the rest with defaults', () => {
		const parsed = parseNotificationConfig({
			conversations: { standard: { sound: 'ton-5', email: false } }
		});
		expect(parsed.conversations.standard.sound).toBe('ton-5');
		expect(parsed.conversations.standard.email).toBe(false);
		// untouched kind keeps its default
		expect(parsed.conversations.new.email).toBe(true);
	});

	it('parses legacy boolean banner values into the 3-state mode', () => {
		const parsed = parseNotificationConfig({
			requests: { new: { banner: false }, standard: { banner: true } },
			conversations: { mention: { banner: 'persistent' } }
		});
		expect(parsed.requests.new.banner).toBe('off');
		expect(parsed.requests.standard.banner).toBe('temporary');
		expect(parsed.conversations.mention.banner).toBe('persistent');
	});

	it('parse tolerates garbage', () => {
		const parsed = parseNotificationConfig({ requests: { new: 42 } });
		expect(parsed.requests.new.sound).toBe('none');
		expect(parsed.requests.new.email).toBe(true);
	});

	it('setKindField updates one field immutably', () => {
		const next = setKindField(
			DEFAULT_NOTIFICATION_CONFIG,
			'requests',
			'new',
			'sound',
			'ton-2'
		);
		expect(next.requests.new.sound).toBe('ton-2');
		expect(next.requests.new.email).toBe(
			DEFAULT_NOTIFICATION_CONFIG.requests.new.email
		);
		// original untouched
		expect(DEFAULT_NOTIFICATION_CONFIG.requests.new.sound).toBe('none');
	});

	it('setKindField toggles email independently per area', () => {
		const next = setKindField(
			DEFAULT_NOTIFICATION_CONFIG,
			'conversations',
			'mention',
			'email',
			true
		);
		expect(next.conversations.mention.email).toBe(true);
		expect(next.requests.mention.email).toBe(false);
	});

	it('clampVolume rounds to the arrow step and stays within [0,1]', () => {
		expect(clampVolume(-1)).toBe(0);
		expect(clampVolume(2)).toBe(1);
		expect(clampVolume(0.5)).toBe(0.5);
		expect(clampVolume(0.6)).toBe(0.5);
		expect(clampVolume(0.75)).toBe(0.75);
	});

	it('maps event families onto the three areas (harmonised model)', () => {
		expect(areaForFamily('requests')).toBe('requests');
		// time-critical hosts calls AND appointments
		expect(areaForFamily('appointments')).toBe('timeCritical');
		expect(areaForFamily('calls')).toBe('timeCritical');
		// everything conversation-shaped lands in "Gespräch"
		expect(areaForFamily('messages')).toBe('conversations');
		expect(areaForFamily('handover')).toBe('conversations');
	});

	it('maps events onto kinds: family rows first, then mention > new > standard', () => {
		expect(kindForEvent('calls', 'call.started', false)).toBe('call');
		expect(
			kindForEvent('appointments', 'appointment.requested', false)
		).toBe('appointment');
		expect(kindForEvent('handover', 'handover.requested', false)).toBe(
			'handover'
		);
		expect(kindForEvent('messages', 'message.new', true)).toBe('mention');
		expect(kindForEvent('requests', 'request.new', false)).toBe('new');
		expect(kindForEvent('requests', 'team.discussion.new', false)).toBe(
			'new'
		);
		expect(kindForEvent('messages', 'message.new', false)).toBe('standard');
	});

	it('drafts never notify; defaults keep calls ringing with banners on', () => {
		expect(NEVER_NOTIFY_FAMILIES).toContain('drafts');
		const call = DEFAULT_NOTIFICATION_CONFIG.timeCritical.call;
		expect(call.sound).toBe('ring');
		expect(call.banner).toBe('temporary');
		expect(DEFAULT_NOTIFICATION_CONFIG.requests.new.banner).toBe(
			'temporary'
		);
	});

	it('soundSettingForEvent returns the configured kind entry for the event', () => {
		const config = setKindField(
			DEFAULT_NOTIFICATION_CONFIG,
			'requests',
			'new',
			'sound',
			'ton-7'
		);
		const hit = soundSettingForEvent(
			config,
			'requests',
			'request.new',
			false
		);
		expect(hit.sound).toBe('ton-7');
		expect(hit.volume).toBe(0.5);
		// a message mention reads conversations.mention
		const mention = soundSettingForEvent(
			config,
			'messages',
			'message.new',
			true
		);
		expect(mention).toBe(config.conversations.mention);
	});

	it('setKindField updates volume immutably', () => {
		const next = setKindField(
			DEFAULT_NOTIFICATION_CONFIG,
			'conversations',
			'standard',
			'volume',
			0.75
		);
		expect(next.conversations.standard.volume).toBe(0.75);
		expect(DEFAULT_NOTIFICATION_CONFIG.conversations.standard.volume).toBe(
			0.5
		);
	});
});
