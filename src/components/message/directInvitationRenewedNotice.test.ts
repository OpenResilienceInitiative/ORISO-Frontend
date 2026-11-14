import { describe, expect, it } from 'vite-plus/test';
import { parseMessagePrefixes } from './messageConstants';
import {
	directInvitationRenewedNoticeText,
	parseDirectInvitationRenewedNotice,
	SYSTEM_NOTIFICATION_DIRECT_INVITATION_RENEWED
} from './directInvitationRenewedNotice';

describe('the "new link" notice of a Direkteinladung (#2252)', () => {
	const payload = {
		type: SYSTEM_NOTIFICATION_DIRECT_INVITATION_RENEWED,
		linkId: 9,
		url: 'https://app.example/invite/new',
		expiresAt: '2026-11-21T14:00:00Z'
	};

	it('reads the link and its end', () => {
		expect(parseDirectInvitationRenewedNotice(payload)).toEqual({
			url: 'https://app.example/invite/new',
			expiresAt: '2026-11-21T14:00:00Z'
		});
	});

	it('keeps a notice without an end', () => {
		expect(
			parseDirectInvitationRenewedNotice({ ...payload, expiresAt: null })
		).toEqual({ url: 'https://app.example/invite/new' });
	});

	it.each([
		['another type', { ...payload, type: 'CONSULTANT_RENAMED' }],
		['no link', { ...payload, url: '' }],
		[
			'a script link',
			{ ...payload, url: ['javascript', 'alert(1)'].join(':') }
		],
		['nothing', null]
	])('ignores %s', (_name, value) => {
		expect(parseDirectInvitationRenewedNotice(value)).toBeNull();
	});

	it('dates the end in informal German without breaking the message', () => {
		const text = directInvitationRenewedNoticeText(
			{ url: payload.url, expiresAt: payload.expiresAt },
			(key, options) => `${key} ${String(options?.date ?? '')}`.trim(),
			'de@informal'
		);
		expect(text.description).toMatch(
			/^directInvitation\.renewed\.validUntil .*Nov/
		);
	});

	it('previews as its link, never as the raw payload', () => {
		const parsed = parseMessagePrefixes(
			`[SYSTEM_NOTIFICATION]${JSON.stringify(payload)}`
		);
		expect(parsed.cleanedMessage).toBe('https://app.example/invite/new');
	});
});
