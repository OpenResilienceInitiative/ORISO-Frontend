import { describe, expect, it } from 'vite-plus/test';
import { emailSettingForKind } from './emailSettingForKind';

/** The stored field or e-mail toggle behind a kind's E-Mail cell, or null. */
const stored = (
	...args: Parameters<typeof emailSettingForKind>
): string | null => {
	const entry = emailSettingForKind(...args);
	if (!entry) return null;
	return entry.source.kind === 'settings'
		? entry.source.field
		: entry.source.type;
};

describe('emailSettingForKind (FE#1377 redesign, E-Mail column)', () => {
	it.each([
		['oneToOne', 'NEW_CHAT_MESSAGE_FROM_ADVICE_SEEKER'],
		['appointments', 'appointmentNotificationEnabled'],
		['liveChat', null],
		// internalChatNotificationEnabled exists only in the UserService
		// integration branch (draft PR #1666), not in this API.
		['internalGroup', null],
		['circle', null],
		// Frank 2026-10-15: Supervision → the profile's Fachaustausch switch.
		['supervision', 'feedbackNotificationEnabled'],
		['other', null],
		['unread', null]
	])('Gespräche, counsellor: %s → %s', (kind, expected) => {
		expect(stored('sessions', kind, 'consultant')).toBe(expected);
	});

	it.each([
		['nearby', 'initialEnquiryNotificationEnabled'],
		['liveChat', null],
		['other', null]
	])('Anfragen, counsellor: %s → %s', (kind, expected) => {
		expect(stored('requests', kind, 'consultant')).toBe(expected);
	});

	it.each([
		['requests', 'initialEnquiryNotificationEnabled'],
		['messages', 'NEW_CHAT_MESSAGE_FROM_ADVICE_SEEKER'],
		['handover', 'reassignmentNotificationEnabled'],
		['system', 'serviceNoticeNotificationEnabled'],
		['appointments', 'appointmentNotificationEnabled'],
		['drafts', null],
		['calls', null],
		['other', null]
	])('Zeitstrahl, counsellor: %s → %s', (kind, expected) => {
		expect(stored('timeline', kind, 'consultant')).toBe(expected);
	});

	it('uses the advice seeker list for advice seekers (their own new-message flag, no enquiries)', () => {
		expect(stored('sessions', 'oneToOne', 'asker')).toBe(
			'newChatMessageNotificationEnabled'
		);
		expect(stored('timeline', 'requests', 'asker')).toBeNull();
		// Fachaustausch is a counsellor switch only.
		expect(stored('sessions', 'supervision', 'asker')).toBeNull();
		expect(stored('timeline', 'handover', 'asker')).toBe(
			'reassignmentNotificationEnabled'
		);
	});

	it('hands back the profile switch itself, so both screens share one entry', () => {
		expect(
			emailSettingForKind('sessions', 'oneToOne', 'consultant')?.id
		).toBe('newMessage');
	});
});
