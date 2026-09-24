// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
import { fetchData, FETCH_ERRORS, FETCH_METHODS } from './fetchData';
import { apiGetInviteLinkContext } from './apiGetInviteLinkContext';

vi.mock('./fetchData', async () => {
	const actual =
		await vi.importActual<typeof import('./fetchData')>('./fetchData');
	return { ...actual, fetchData: vi.fn(() => Promise.resolve({})) };
});

beforeEach(() => vi.clearAllMocks());

/* The page waits on this before it either opens the live-chat room or falls
   back to redeeming on arrival: a server that accepts the connection and never
   answers must not hold every invite on the loader. */
it('asks without credentials and gives up after a bounded time', async () => {
	await apiGetInviteLinkContext('tok/en');

	expect(fetchData).toHaveBeenCalledWith(
		expect.objectContaining({
			url: expect.stringMatching(
				/\/service\/users\/invitelinks\/tok%2Fen\/context$/
			),
			method: FETCH_METHODS.GET,
			skipAuth: true,
			responseHandling: [FETCH_ERRORS.CATCH_ALL],
			timeout: expect.any(Number)
		})
	);
	const { timeout } = vi.mocked(fetchData).mock.calls[0][0] as {
		timeout: number;
	};
	expect(timeout).toBeLessThanOrEqual(10_000);
});
