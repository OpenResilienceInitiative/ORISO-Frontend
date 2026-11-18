// @vitest-environment oriso-jsdom
import { beforeEach, expect, it, vi } from 'vite-plus/test';
import { fetchData, FETCH_METHODS } from './fetchData';
import { apiGetGroupInviteContext } from './apiGetGroupInviteContext';

vi.mock('./fetchData', async () => {
	const actual =
		await vi.importActual<typeof import('./fetchData')>('./fetchData');
	return { ...actual, fetchData: vi.fn(() => Promise.resolve({})) };
});

beforeEach(() => vi.clearAllMocks());

/* UserService#1662: the Gesprächskreis entry reads the circle's guest account
   mode before the newcomer has an account, and must not wait forever. */
it('asks without credentials, with the link’s agency and token, for a bounded time', async () => {
	await apiGetGroupInviteContext(19, '7', 'q2/Vx');

	expect(fetchData).toHaveBeenCalledWith(
		expect.objectContaining({
			url: expect.stringMatching(
				/\/service\/users\/chat\/19\/invite-context\?agencyId=7&inviteToken=q2%2FVx$/
			),
			method: FETCH_METHODS.GET,
			skipAuth: true,
			timeout: expect.any(Number)
		})
	);
	const { timeout } = vi.mocked(fetchData).mock.calls[0][0] as {
		timeout: number;
	};
	expect(timeout).toBeLessThanOrEqual(10_000);
});
