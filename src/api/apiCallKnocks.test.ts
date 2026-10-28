import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

const fetchData = vi.hoisted(() => vi.fn());
vi.mock('./fetchData', async (importOriginal) => ({
	...(await importOriginal<typeof import('./fetchData')>()),
	fetchData
}));
vi.mock('../resources/scripts/endpoints', () => ({
	endpoints: { callKnocks: 'https://api.test/service/users/call-knocks' }
}));

const api = await import('./apiCallKnocks');

const BASE = 'https://api.test/service/users/call-knocks';
const ROOM = { matrixRoomId: '!s:m.test' };
const Q = 'matrixRoomId=!s%3Am.test';

/** The knock contract of ORISO-UserService#1479 (`api/userservice.yaml`). */
describe('apiCallKnocks (#1892)', () => {
	beforeEach(() => fetchData.mockReset().mockResolvedValue([]));

	it.each([
		[
			'lists pending knocks of this call',
			() => api.apiGetPendingCallKnocks(ROOM),
			'GET',
			`${BASE}?${Q}`
		],
		[
			'admits one',
			() => api.apiAdmitCallKnock(7),
			'POST',
			`${BASE}/7/admit`
		],
		[
			'declines one',
			() => api.apiDeclineCallKnock(7),
			'POST',
			`${BASE}/7/decline`
		],
		[
			'admits all of this call',
			() => api.apiAdmitAllCallKnocks({ sessionId: 9 }),
			'POST',
			`${BASE}/admit-all?sessionId=9`
		]
	])('%s', async (_, call, method, url) => {
		await call();
		expect(fetchData).toHaveBeenCalledWith(
			expect.objectContaining({ url, method })
		);
		expect(fetchData.mock.calls[0][0].responseHandling).toEqual(
			expect.arrayContaining(['FORBIDDEN', 'NO_MATCH', 'CONFLICT'])
		);
	});

	it('reads an empty answer as nobody waiting', async () => {
		fetchData.mockResolvedValue({});
		await expect(api.apiGetPendingCallKnocks(ROOM)).resolves.toEqual([]);
	});
});
