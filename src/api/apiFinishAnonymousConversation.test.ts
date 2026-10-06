// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
import { fetchData } from './fetchData';
import { apiFinishAnonymousConversation } from './apiFinishAnonymousConversation';

vi.mock('./fetchData', async () => {
	const actual =
		await vi.importActual<typeof import('./fetchData')>('./fetchData');
	return { ...actual, fetchData: vi.fn(() => Promise.resolve()) };
});
beforeEach(() => vi.clearAllMocks());

it('finishes as the signed-in user by default', async () => {
	await apiFinishAnonymousConversation(42);

	const call = vi.mocked(fetchData).mock.calls[0][0];
	expect(call.skipAuth).toBeFalsy();
	expect(call.headersData).toBeUndefined();
});

/* A redeem discarded because a counsellor signed in meanwhile: the guest's
   session must be finished with the guest's own token, never the
   counsellor's, and without writing the guest's token anywhere. */
it('finishes with an explicit guest token, without the browser session', async () => {
	await apiFinishAnonymousConversation(42, 'guest-access');

	const call = vi.mocked(fetchData).mock.calls[0][0];
	expect(call.skipAuth).toBe(true);
	expect(call.headersData).toEqual({ Authorization: 'Bearer guest-access' });
});
