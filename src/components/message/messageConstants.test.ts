import { describe, expect, it } from 'vitest';
import { parseMessagePrefixes, buildVisibleToPrefix } from './messageConstants';

/**
 * ADR-017 hard cut: `[THREAD:…]` no longer carries thread identity. These
 * guard the one behaviour that survives — a purely cosmetic strip of a
 * leftover leading token — plus the unrelated prefixes that must keep working.
 */
describe('parseMessagePrefixes — ADR-017 thread cosmetic strip', () => {
	it('strips a leading [THREAD:…] token from the body with no thread semantics', () => {
		const parsed = parseMessagePrefixes('[THREAD:$root:hs] Hallo Welt');

		expect(parsed.cleanedMessage).toBe('Hallo Welt');
		// No thread fields are exposed anymore.
		expect(parsed).not.toHaveProperty('threadRootId');
		expect(parsed).not.toHaveProperty('isThreadMessage');
	});

	it('leaves a message without the token untouched', () => {
		expect(parseMessagePrefixes('kein Prefix hier').cleanedMessage).toBe(
			'kein Prefix hier'
		);
	});

	it('keeps VISIBLE_TO parsing intact (ADR-008 aside routing)', () => {
		const parsed = parseMessagePrefixes(
			`${buildVisibleToPrefix(['u1', 'u2'])} geheim`
		);

		expect(parsed.visibleToUserIds).toEqual(['u1', 'u2']);
		expect(parsed.cleanedMessage).toBe('geheim');
	});

	it('still strips the [THREAD:…] token even when combined with VISIBLE_TO', () => {
		const parsed = parseMessagePrefixes(
			`[THREAD:$root:hs] ${buildVisibleToPrefix(['u1'])} inhalt`
		);

		expect(parsed.visibleToUserIds).toEqual(['u1']);
		expect(parsed.cleanedMessage).toBe('inhalt');
	});
});

describe('persisted handover grant metadata', () => {
	const event = (metadata: unknown) =>
		'[SYSTEM_NOTIFICATION]' +
		JSON.stringify({
			type: 'CASE_HANDOVER_GRANTED',
			description: 'The counsellor has taken over.',
			handover: metadata
		});
	it('keeps the event-time NONE and completed takeover metadata', () => {
		expect(
			parseMessagePrefixes(
				event({
					requestId: 42,
					clientConsent: 'NONE',
					accessType: 'TAKEOVER'
				})
			).systemNotificationHandoverGrant
		).toEqual({
			requestId: 42,
			clientConsent: 'NONE',
			accessType: 'TAKEOVER'
		});
	});
	it.each([
		undefined,
		null,
		{},
		{ requestId: 0, clientConsent: 'NONE', accessType: 'TAKEOVER' },
		{ requestId: 42, clientConsent: 'UNKNOWN', accessType: 'TAKEOVER' },
		{ requestId: 42, clientConsent: 'NONE', accessType: 'UNKNOWN' }
	])(
		'does not infer a policy for missing or malformed metadata: %j',
		(metadata) => {
			const parsed = parseMessagePrefixes(event(metadata));
			expect(parsed.systemNotificationHandoverGrant).toBeNull();
			expect(parsed.systemNotificationDescription).toBe(
				'The counsellor has taken over.'
			);
		}
	);
});

describe('persisted initial acceptance metadata', () => {
	const event = (acceptance: unknown) =>
		'[SYSTEM_NOTIFICATION]' +
		JSON.stringify({ type: 'INQUIRY_ACCEPTED', acceptance });
	it('keeps the exact immutable acceptance scope and timestamp', () => {
		expect(
			parseMessagePrefixes(
				event({ sessionId: 73, acceptedAt: '2026-10-09T10:20:00Z' })
			).systemNotificationAcceptance
		).toEqual({ sessionId: 73, acceptedAt: '2026-10-09T10:20:00Z' });
	});
	it.each([
		undefined,
		{},
		{ sessionId: 0, acceptedAt: '2026-10-09T10:20:00Z' },
		{ sessionId: 73, acceptedAt: 'not-a-date' },
		{ sessionId: 73, acceptedAt: '2026-02-30T10:20:00Z' },
		{ sessionId: 73, acceptedAt: '2026-10-09T10:20:00' }
	])('rejects incomplete or invalid acceptance metadata: %j', (metadata) => {
		expect(
			parseMessagePrefixes(event(metadata)).systemNotificationAcceptance
		).toBeNull();
	});
});
