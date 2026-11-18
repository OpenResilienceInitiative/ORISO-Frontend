import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

const fetchData = vi.hoisted(() => vi.fn());
vi.mock('./fetchData', async (importOriginal) => ({
	...(await importOriginal<typeof import('./fetchData')>()),
	fetchData
}));
vi.mock('../resources/scripts/endpoints', () => ({
	endpoints: {
		matrixCallShareLinks:
			'https://api.test/service/matrix/calls/share-links'
	}
}));

const api = await import('./apiCallShareLinkKnock');

const BASE = 'https://api.test/service/matrix/calls/share-links';
const CALL = { sourceRoomId: '!s:m.test', callId: 'c 1' };
const LINK = { id: 7, knock: true, active: true, url: 'https://x/invite/t' };

/** The share-link contract of ORISO-UserService#1488 (`CallShareLinkController`). */
describe('apiCallShareLinkKnock (#1892)', () => {
	// A block, not an arrow value: a function returned here runs as teardown.
	beforeEach(() => {
		fetchData.mockReset().mockResolvedValue(LINK);
	});

	it('reads the call link without creating one', async () => {
		await expect(api.apiGetCallShareLinkKnock(CALL)).resolves.toEqual({
			id: 7,
			knock: true
		});
		expect(fetchData).toHaveBeenCalledWith(
			expect.objectContaining({
				method: 'GET',
				url: `${BASE}?sourceRoomId=%21s%3Am.test&callId=c+1`
			})
		);
	});

	it.each(['NO_MATCH', 'FORBIDDEN'])('is null on %s', async (status) => {
		fetchData.mockRejectedValue(new Error(status));
		await expect(api.apiGetCallShareLinkKnock(CALL)).resolves.toBeNull();
	});

	/* UserService#1662: the server answers the lookup with the full response,
	   so a call that cannot be shared is told from a call without a link yet. */
	const answer = (status: number, reason?: string) =>
		new Response(null, {
			status,
			headers: reason ? { 'X-Reason': reason } : {}
		});

	it.each([404, 403])(
		'is null on a %s response without a reason',
		async (status) => {
			fetchData.mockRejectedValue(answer(status));
			await expect(
				api.apiGetCallShareLinkKnock(CALL)
			).resolves.toBeNull();
		}
	);

	it('says so when the call cannot be shared at all (UserService#1662)', async () => {
		fetchData.mockRejectedValue(answer(404, 'CALL_SHARE_LINK_NO_CALL'));
		const refusal = await api
			.apiGetCallShareLinkKnock(CALL)
			.catch((e) => e);
		expect(api.isCallNotShareable(refusal)).toBe(true);
		expect(api.isCallNotShareable(new Error('CATCH_ALL'))).toBe(false);
	});

	it('throws, but not as "not shareable", when the server failed', async () => {
		fetchData.mockRejectedValue(answer(500));
		const refusal = await api
			.apiGetCallShareLinkKnock(CALL)
			.catch((e) => e);
		expect(refusal).toBeInstanceOf(Error);
		expect(api.isCallNotShareable(refusal)).toBe(false);
	});

	it('throws when the server did not answer', async () => {
		fetchData.mockRejectedValue(new Error('CATCH_ALL'));
		await expect(api.apiGetCallShareLinkKnock(CALL)).rejects.toThrow();
	});

	it('is null for an ended link', async () => {
		fetchData.mockResolvedValue({ ...LINK, active: false });
		await expect(api.apiGetCallShareLinkKnock(CALL)).resolves.toBeNull();
	});

	it('changes only Anklopfen and returns the stored value', async () => {
		fetchData.mockResolvedValue({ ...LINK, knock: false });
		await expect(api.apiSetCallShareLinkKnock(7, false)).resolves.toBe(
			false
		);
		expect(fetchData).toHaveBeenCalledWith(
			expect.objectContaining({
				method: 'PATCH',
				url: `${BASE}/7`,
				bodyData: JSON.stringify({ knock: false })
			})
		);
	});

	it('throws when the change did not land', async () => {
		fetchData.mockRejectedValue(new Error('NO_MATCH'));
		await expect(api.apiSetCallShareLinkKnock(7, false)).rejects.toThrow();
	});
});
