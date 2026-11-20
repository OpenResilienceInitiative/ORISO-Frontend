// @vitest-environment oriso-jsdom
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { isTakenGuestName, redeemInviteLink } from './apiRedeemInviteLink';

afterEach(() => {
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

const okSession = () =>
	new Response(
		JSON.stringify({ sessionId: 42, accessToken: 'a', userName: 'enc.x' }),
		{ status: 200 }
	);

/* ORISO-Frontend#2346: the rolled User-ID is the login of the new guest. */
describe('redeemInviteLink', () => {
	it('sends the rolled User-ID so the server creates exactly that login', async () => {
		const fetchMock = vi.fn().mockResolvedValue(okSession());
		vi.stubGlobal('fetch', fetchMock);

		await redeemInviteLink('synthetic-invite', 'katze_sam_4821');

		const init = fetchMock.mock.calls[0][1] as RequestInit;
		expect(JSON.parse(init.body as string)).toEqual({
			username: 'katze_sam_4821'
		});
	});

	it('sends no body when the caller has no rolled User-ID', async () => {
		const fetchMock = vi.fn().mockResolvedValue(okSession());
		vi.stubGlobal('fetch', fetchMock);

		await redeemInviteLink('synthetic-invite');

		expect(
			(fetchMock.mock.calls[0][1] as RequestInit).body
		).toBeUndefined();
	});

	it('hands a taken name back as the response, so the room can roll again', async () => {
		const taken = new Response('', { status: 409 });
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(taken));

		const failure = await redeemInviteLink(
			'synthetic-invite',
			'katze_sam_4821'
		).catch((error: unknown) => error);

		expect(failure).toBe(taken);
		expect(isTakenGuestName(failure)).toBe(true);
		expect(isTakenGuestName(new Response('', { status: 400 }))).toBe(false);
		expect(isTakenGuestName(new Error('x'))).toBe(false);
	});
});
