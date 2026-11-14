import { describe, expect, it } from 'vitest';
import { bookingMetadata, pickBookingSession } from './bookingSession';

const conv = (id: number, agencyId?: number, status = 2) =>
	({
		session: { id, status },
		agency: agencyId ? { id: agencyId } : undefined,
		consultant: { consultantId: `c-${id}` }
	}) as any;

describe('pickBookingSession (#2010)', () => {
	const sessions = [conv(1, 10), conv(2, 20)];

	it('books the conversation the user came from, not the first one', () => {
		expect(pickBookingSession(sessions, '2')?.session.id).toBe(2);
	});

	it('books nothing when the given conversation is not the user’s', () => {
		expect(pickBookingSession(sessions, '99')).toBeUndefined();
	});

	it('falls back to the only conversation with an agency when none is given', () => {
		expect(
			pickBookingSession([conv(3), conv(4, 40)], null)?.session.id
		).toBe(4);
	});

	it('does not guess between several conversations when none is given', () => {
		expect(pickBookingSession(sessions, null)).toBeUndefined();
	});
});

describe('bookingMetadata (#2010)', () => {
	it('never hands the login token to cal.com', () => {
		const meta = bookingMetadata({ userId: 'u1' } as any, conv(2, 20));
		expect(Object.keys(meta).join(' ')).not.toMatch(/token/i);
		expect(JSON.stringify(meta)).not.toMatch(/keycloak/i);
		expect(meta).toEqual({
			'metadata[user]': 'u1',
			'metadata[isInitialAppointment]': false,
			'metadata[sessionId]': 2
		});
	});
});
