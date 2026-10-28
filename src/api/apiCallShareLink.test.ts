// @vitest-environment oriso-jsdom
import { beforeEach, expect, it, vi } from 'vite-plus/test';
import {
	fetchData,
	FETCH_ERRORS,
	FETCH_METHODS,
	FETCH_SUCCESS
} from './fetchData';
import {
	apiCreateCallShareLink,
	apiUpdateCallShareLink
} from './apiCallShareLink';

vi.mock('./fetchData', async () => {
	const actual =
		await vi.importActual<typeof import('./fetchData')>('./fetchData');
	return { ...actual, fetchData: vi.fn() };
});

const link = {
	id: 7,
	token: 'abc',
	url: 'https://app.example/invite/abc',
	medium: 'VIDEO',
	knock: true,
	temporaryAccount: false,
	temporaryAccountAllowed: false,
	active: true,
	expiresAt: '2026-10-28T20:00:00Z'
};

beforeEach(() => vi.clearAllMocks());

it('creates the link of this one call (or gets the existing one)', async () => {
	vi.mocked(fetchData).mockResolvedValue(link);

	await expect(
		apiCreateCallShareLink({ sourceRoomId: '!room:x', callId: 'c1' })
	).resolves.toEqual({
		id: 7,
		url: link.url,
		settings: { knock: true, temporaryAccount: false },
		temporaryAccountAllowed: false
	});
	const call = vi.mocked(fetchData).mock.calls[0][0];
	expect(call.url).toMatch(/\/service\/matrix\/calls\/share-links$/);
	expect(call.method).toBe(FETCH_METHODS.POST);
	// Without CONTENT, fetchData hands back the raw Response for a POST.
	expect(call.responseHandling).toContain(FETCH_SUCCESS.CONTENT);
	expect(JSON.parse(call.bodyData as string)).toEqual({
		sourceRoomId: '!room:x',
		callId: 'c1'
	});
});

/* 403 sharing not allowed, 404 not in the call, 410 call over, 5xx: no button. */
it('answers null when the call cannot be shared', async () => {
	vi.mocked(fetchData).mockRejectedValue(new Error(FETCH_ERRORS.FORBIDDEN));

	await expect(
		apiCreateCallShareLink({ sourceRoomId: '!room:x', callId: 'c1' })
	).resolves.toBeNull();
});

it('answers null for a body that is not a usable link', async () => {
	vi.mocked(fetchData).mockResolvedValue({
		...link,
		url: 'ftp://app.example/invite/abc'
	});

	await expect(
		apiCreateCallShareLink({ sourceRoomId: '!room:x', callId: 'c1' })
	).resolves.toBeNull();
});

it('changes the settings of the same link', async () => {
	vi.mocked(fetchData).mockResolvedValue({ ...link, knock: false });

	await expect(
		apiUpdateCallShareLink(7, { knock: false, temporaryAccount: false })
	).resolves.toEqual({ knock: false, temporaryAccount: false });
	const call = vi.mocked(fetchData).mock.calls[0][0];
	expect(call.url).toMatch(/\/service\/matrix\/calls\/share-links\/7$/);
	expect(call.method).toBe(FETCH_METHODS.PATCH);
	expect(call.responseHandling).toContain(FETCH_SUCCESS.CONTENT);
	expect(JSON.parse(call.bodyData as string)).toEqual({
		knock: false,
		temporaryAccount: false
	});
});

it('throws when the change did not reach the server', async () => {
	vi.mocked(fetchData).mockRejectedValue(new Error(FETCH_ERRORS.CATCH_ALL));

	await expect(
		apiUpdateCallShareLink(7, { knock: false, temporaryAccount: true })
	).rejects.toThrow();
});
