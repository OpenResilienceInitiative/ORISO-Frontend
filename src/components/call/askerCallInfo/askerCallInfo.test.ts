import { describe, expect, it } from 'vite-plus/test';
import type { SessionAppointment } from '../../../api/apiSessionAppointments';
import { askerCallInfoState, canAskerSeeCallInfo } from './askerCallInfo';

const now = new Date('2026-11-17T10:00:00Z');
const appointment = (
	over: Partial<SessionAppointment> = {}
): SessionAppointment => ({
	id: 'a1',
	sessionId: 7,
	startTime: '2026-11-19T14:00:00Z',
	endTime: '2026-11-19T15:00:00Z',
	status: 'SCHEDULED',
	kind: 'VIDEO',
	...over
});

describe('askerCallInfoState', () => {
	it('is loading while nothing has been read yet', () => {
		expect(askerCallInfoState(undefined, now)).toEqual({
			status: 'loading'
		});
	});

	it('names a request waiting for the counsellor as requested (FE#2287)', () => {
		expect(
			askerCallInfoState([appointment({ status: 'REQUESTED' })], now)
		).toEqual({
			status: 'appointment',
			start: new Date('2026-11-19T14:00:00Z'),
			end: new Date('2026-11-19T15:00:00Z'),
			medium: 'video',
			requested: true
		});
	});

	it('ignores a declined request (FE#2287)', () => {
		expect(
			askerCallInfoState([appointment({ status: 'DECLINED' })], now)
		).toEqual({ status: 'none' });
	});

	it('is an error when the read failed', () => {
		expect(askerCallInfoState('error', now)).toEqual({ status: 'error' });
	});

	it('names the next scheduled appointment with its medium', () => {
		const later = appointment({
			id: 'later',
			startTime: '2026-11-25T14:00:00Z',
			endTime: '2026-11-25T15:00:00Z'
		});
		const next = appointment({ id: 'next', kind: 'PHONE' });
		expect(askerCallInfoState([later, next], now)).toEqual({
			status: 'appointment',
			start: new Date('2026-11-19T14:00:00Z'),
			end: new Date('2026-11-19T15:00:00Z'),
			medium: 'phone'
		});
	});

	it('treats an appointment without kind as a video call', () => {
		const state = askerCallInfoState([appointment({ kind: null })], now);
		expect(state).toMatchObject({ medium: 'video' });
	});

	it('maps on-site and chat appointments to their own medium', () => {
		expect(
			askerCallInfoState([appointment({ kind: 'ONSITE' })], now)
		).toMatchObject({ medium: 'onsite' });
		expect(
			askerCallInfoState([appointment({ kind: 'CHAT' })], now)
		).toMatchObject({ medium: 'chat' });
	});

	it('has none when every appointment is cancelled or over', () => {
		expect(
			askerCallInfoState(
				[
					appointment({ status: 'CANCELLED' }),
					appointment({
						startTime: '2026-11-10T14:00:00Z',
						endTime: '2026-11-10T15:00:00Z'
					})
				],
				now
			)
		).toEqual({ status: 'none' });
	});
});

describe('canAskerSeeCallInfo', () => {
	const base = {
		isAsker: true,
		isConsultant: false,
		isSession: true,
		isGroup: false,
		isEnquiryList: false,
		isRejectedCase: false,
		isSupervisor: false,
		videoCallAllowed: true
	};

	it('is open to an advice seeker in a 1:1 conversation with calls', () => {
		expect(canAskerSeeCallInfo(base)).toBe(true);
	});

	it.each([
		['a counsellor', { isConsultant: true }],
		['nobody with the asker role', { isAsker: false }],
		['a group chat', { isGroup: true }],
		['an enquiry', { isEnquiryList: true }],
		['a rejected case', { isRejectedCase: true }],
		['a supervisor', { isSupervisor: true }],
		['a consulting type without calls', { videoCallAllowed: false }],
		['no session yet', { isSession: false }]
	])('stays closed for %s', (_label, over) => {
		expect(canAskerSeeCallInfo({ ...base, ...over })).toBe(false);
	});
});
