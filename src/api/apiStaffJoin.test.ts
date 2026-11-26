import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

const fetchData = vi.hoisted(() => vi.fn());
vi.mock('./fetchData', async (importOriginal) => ({
	...(await importOriginal<typeof import('./fetchData')>()),
	fetchData
}));
vi.mock('../resources/scripts/endpoints', () => ({
	endpoints: {
		inviteLinksBase: 'https://api.test/service/users/invitelinks/'
	}
}));

const api = await import('./apiStaffJoin');

const URL = 'https://api.test/service/users/invitelinks/t%2F1/staff-join';
const SEATED = {
	outcome: 'SEATED',
	medium: 'VIDEO',
	sourceRoomId: '!source:m.test',
	callId: 'call-1',
	callRoomId: '!call:m.test',
	guestMatrixUserId: '@c:m.test',
	sessionId: null
};

/** The staff-join contract of ORISO-UserService (`api/userservice.yaml`). */
describe('apiStaffJoin (#2356)', () => {
	beforeEach(() => fetchData.mockReset());

	it('posts to the staff route of the link, with the knock it waits on', async () => {
		fetchData.mockResolvedValue({ outcome: 'WAITING', knockId: 9 });
		await expect(api.apiStaffJoin('t/1', 9)).resolves.toEqual({
			outcome: 'WAITING',
			knockId: 9
		});
		expect(fetchData.mock.calls[0][0]).toMatchObject({
			url: `${URL}?waitingFor=9`,
			method: 'POST'
		});
	});

	it('leaves through DELETE on the same route', async () => {
		fetchData.mockResolvedValue(undefined);
		await api.apiLeaveStaffJoin('t/1');
		expect(fetchData.mock.calls[0][0]).toMatchObject({
			url: URL,
			method: 'DELETE'
		});
	});

	it('reads a seat in the call room only, never the conversation', () => {
		expect(api.parseStaffJoin(SEATED)).toEqual({
			outcome: 'SEATED',
			seat: {
				medium: 'VIDEO',
				sourceRoomId: '!source:m.test',
				callId: 'call-1',
				callRoomId: '!call:m.test',
				guestMatrixUserId: '@c:m.test'
			}
		});
	});

	it.each([
		[
			'the conversation room as call room',
			{ callRoomId: '!source:m.test' }
		],
		['no call id', { callId: '' }],
		['a chat medium', { medium: 'CHAT' }],
		['a user id that is not Matrix', { guestMatrixUserId: 'c' }]
	])('refuses a seat with %s', (_, change) => {
		expect(() => api.parseStaffJoin({ ...SEATED, ...change })).toThrow();
	});

	it.each([
		[
			{ outcome: 'MEMBER', sessionId: 42 },
			{ outcome: 'MEMBER', sessionId: 42 }
		],
		[{ outcome: 'CALL_NOT_RUNNING' }, { outcome: 'CALL_NOT_RUNNING' }],
		[{ outcome: 'REFUSED', knockId: 3 }, { outcome: 'REFUSED' }],
		[{ outcome: 'NO_SHARED_CALL' }, { outcome: 'NO_SHARED_CALL' }]
	])('reads %o', (body, expected) => {
		expect(api.parseStaffJoin(body)).toEqual(expected);
	});

	it.each([
		[{ outcome: 'MEMBER' }],
		[{ outcome: 'WAITING', knockId: 0 }],
		[{ outcome: 'SOMETHING' }],
		[null]
	])('refuses %o', (body) => {
		expect(() => api.parseStaffJoin(body)).toThrow();
	});
});
