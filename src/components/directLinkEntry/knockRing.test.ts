// @vitest-environment oriso-jsdom
import { describe, expect, it } from 'vite-plus/test';
import { isKnockingOnCall, PendingKnock } from './directLinkEntryFlow';

/* P0, Direkteinladung: a guest who knocked on a call is waiting to be let in.
   The counsellor starting the call must not ring them with "Annehmen": that
   button opens the call without admission and ends in "Call access denied". */
const knock = (patch: Partial<PendingKnock> = {}): PendingKnock => ({
	token: 't',
	knockId: 7,
	sessionId: 134,
	matrixRoomId: '!room:dev',
	medium: 'VIDEO',
	status: 'PENDING',
	...patch
});

describe('isKnockingOnCall', () => {
	it('is true for a waiting knock on the ringing call’s room', () => {
		expect(isKnockingOnCall(knock(), ['!room:dev'])).toBe(true);
	});

	it('matches any of the call’s room ids (signal room, call room)', () => {
		expect(isKnockingOnCall(knock(), [undefined, '!room:dev'])).toBe(true);
	});

	it('is false without a pending knock', () => {
		expect(isKnockingOnCall(null, ['!room:dev'])).toBe(false);
	});

	it('is false for another conversation’s call', () => {
		expect(isKnockingOnCall(knock(), ['!other:dev'])).toBe(false);
	});

	it('is false once the person was let in', () => {
		expect(
			isKnockingOnCall(knock({ status: 'ADMITTED' }), ['!room:dev'])
		).toBe(false);
	});

	it('is false when the knock has no room to compare', () => {
		expect(
			isKnockingOnCall(knock({ matrixRoomId: null }), ['!room:dev'])
		).toBe(false);
	});
});
