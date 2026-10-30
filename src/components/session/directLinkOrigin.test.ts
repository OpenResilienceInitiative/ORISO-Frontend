import { describe, expect, it } from 'vite-plus/test';
import { directLinkLabelKey, getDirectLinkMedium } from './directLinkOrigin';

/**
 * FE#1952: a conversation a person opened through a counsellor's direct link
 * was labelled "Mail" in the counsellor's list. The backend now sends the
 * link's medium on the session (`SessionDTO.directLinkMedium`); this module is
 * the one place that reads it.
 */
describe('direct-link origin (FE#1952)', () => {
	const session = (fields: Record<string, unknown>) => ({
		item: {
			id: 1,
			registrationType: 'REGISTERED',
			postcode: 12345,
			...fields
		},
		isGroup: false,
		isSession: true
	});

	it.each(['VIDEO', 'AUDIO', 'CHAT'] as const)(
		'reads the %s medium from an agency-counselling session',
		(medium) => {
			expect(
				getDirectLinkMedium(session({ directLinkMedium: medium }))
			).toBe(medium);
		}
	);

	it('reads it from a list item as well as from the active session', () => {
		expect(
			getDirectLinkMedium({
				session: { id: 1, directLinkMedium: 'VIDEO' }
			} as any)
		).toBe('VIDEO');
	});

	it('says nothing for other conversations, groups and unknown values', () => {
		expect(getDirectLinkMedium(session({}))).toBeUndefined();
		expect(
			getDirectLinkMedium(session({ directLinkMedium: null }))
		).toBeUndefined();
		expect(
			getDirectLinkMedium(session({ directLinkMedium: 'FAX' }))
		).toBeUndefined();
		// A live chat stays a live chat whatever a field says (ADR-006).
		expect(
			getDirectLinkMedium(
				session({
					directLinkMedium: 'VIDEO',
					conversationType: 'LIVE_CHAT'
				})
			)
		).toBeUndefined();
		expect(
			getDirectLinkMedium({
				item: { id: 2, directLinkMedium: 'VIDEO' },
				isGroup: true
			} as any)
		).toBeUndefined();
		expect(getDirectLinkMedium(undefined)).toBeUndefined();
	});

	it('names each medium in plain words, like the other list chips', () => {
		expect(directLinkLabelKey('VIDEO')).toBe(
			'sessionList.item.sessionType.directLinkVideo'
		);
		expect(directLinkLabelKey('AUDIO')).toBe(
			'sessionList.item.sessionType.directLinkAudio'
		);
		expect(directLinkLabelKey('CHAT')).toBe(
			'sessionList.item.sessionType.directLinkChat'
		);
	});
});
