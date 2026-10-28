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

/** The knock contract of ORISO-UserService#1479 (`api/userservice.yaml`). */
describe('apiCallKnocks (#1892)', () => {
	beforeEach(() => fetchData.mockReset().mockResolvedValue([]));

	it.each([
		[
			'lists pending knocks',
			() => api.apiGetPendingCallKnocks(),
			'GET',
			BASE
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
			'admits all',
			() => api.apiAdmitAllCallKnocks(),
			'POST',
			`${BASE}/admit-all`
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
		await expect(api.apiGetPendingCallKnocks()).resolves.toEqual([]);
	});
});
