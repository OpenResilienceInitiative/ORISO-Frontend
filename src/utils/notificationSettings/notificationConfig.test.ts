import { describe, expect, it } from 'vitest';
import {
	clampVolume,
	DEFAULT_NOTIFICATION_CONFIG,
	DISABLED_AREAS,
	parseNotificationConfig,
	setKindField
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

	it('appointments is a disabled area', () => {
		expect(DISABLED_AREAS).toContain('appointments');
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
