// @vitest-environment oriso-jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vite-plus/test';
import { useTimelineDrafts } from './useTimelineDrafts';
import {
	apiFetchUserDrafts,
	type IUserDraftFeedResponse
} from '../api/apiUserDrafts';
import { DRAFTS_UPDATED_EVENT } from '../services/draftStore';

vi.mock('../api/apiUserDrafts', () => ({ apiFetchUserDrafts: vi.fn() }));

const auth = vi.hoisted(() => ({
	identity: 'first-session',
	listener: undefined as (() => void) | undefined
}));
vi.mock('../services/draftCryptographyWindow', () => ({
	getDraftAuthSessionIdentity: () => auth.identity,
	subscribeDraftCryptographyForWindow: (listener: () => void) => {
		auth.listener = listener;
		return () => {
			auth.listener = undefined;
		};
	}
}));

const opaque = 'draft.v1.' + 'a'.repeat(43);

afterEach(() => {
	cleanup();
	vi.mocked(apiFetchUserDrafts).mockReset();
	auth.identity = 'first-session';
});

it('lists open drafts and drops one once it is sent (#1535)', async () => {
	vi.mocked(apiFetchUserDrafts).mockResolvedValue({
		items: [
			{
				scopeKey: 'k',
				opaqueScopeKey: opaque,
				text: 'x',
				updatedAt: '2026-09-07T00:00:00Z'
			}
		],
		page: 0,
		perPage: 200
	});
	const { result } = renderHook(() => useTimelineDrafts());
	await waitFor(() => expect(result.current).toHaveLength(1));
	expect(result.current[0].eventType).toBe('draft.created');

	vi.mocked(apiFetchUserDrafts).mockResolvedValue({
		items: [],
		page: 0,
		perPage: 200
	});
	act(() => {
		window.dispatchEvent(new Event(DRAFTS_UPDATED_EVENT));
	});
	await waitFor(() => expect(result.current).toHaveLength(0));
});

it('stops listening after unmount', async () => {
	vi.mocked(apiFetchUserDrafts).mockResolvedValue({
		items: [],
		page: 0,
		perPage: 200
	});
	const { unmount } = renderHook(() => useTimelineDrafts());
	await waitFor(() => expect(apiFetchUserDrafts).toHaveBeenCalledTimes(1));
	unmount();
	window.dispatchEvent(new Event(DRAFTS_UPDATED_EVENT));
	expect(apiFetchUserDrafts).toHaveBeenCalledTimes(1);
});

it('keeps the shown drafts when a refresh fails', async () => {
	vi.mocked(apiFetchUserDrafts).mockResolvedValue({
		items: [
			{
				scopeKey: 'k',
				opaqueScopeKey: opaque,
				text: 'x',
				updatedAt: '2026-09-07T00:00:00Z'
			}
		],
		page: 0,
		perPage: 200
	});
	const { result } = renderHook(() => useTimelineDrafts());
	await waitFor(() => expect(result.current).toHaveLength(1));

	vi.mocked(apiFetchUserDrafts).mockRejectedValue(new Error('offline'));
	act(() => {
		window.dispatchEvent(new Event(DRAFTS_UPDATED_EVENT));
	});
	await waitFor(() => expect(apiFetchUserDrafts).toHaveBeenCalledTimes(2));
	await act(async () => {});
	expect(result.current).toHaveLength(1);
});

it('drops the old preview and in-flight response when session or crypto readiness changes', async () => {
	const old: IUserDraftFeedResponse = {
		items: [{ scopeKey: 'k', opaqueScopeKey: opaque, text: 'old' }],
		page: 0,
		perPage: 200
	};
	let resolveOld!: (response: IUserDraftFeedResponse) => void;
	const pending = new Promise<IUserDraftFeedResponse>((resolve) => {
		resolveOld = resolve;
	});
	vi.mocked(apiFetchUserDrafts)
		.mockResolvedValueOnce(old)
		.mockReturnValueOnce(pending);
	const { result } = renderHook(() => useTimelineDrafts());
	await waitFor(() => expect(result.current).toHaveLength(1));
	act(() => {
		window.dispatchEvent(new Event(DRAFTS_UPDATED_EVENT));
	});
	await waitFor(() => expect(apiFetchUserDrafts).toHaveBeenCalledTimes(2));

	vi.mocked(apiFetchUserDrafts).mockRejectedValueOnce(
		new Error('not unlocked')
	);
	auth.identity = 'next-session';
	act(() => auth.listener?.());
	expect(result.current).toHaveLength(0);
	await act(async () => {
		resolveOld(old);
	});
	expect(result.current).toHaveLength(0);

	const nextOpaque = 'draft.v1.' + 'b'.repeat(43);
	vi.mocked(apiFetchUserDrafts).mockResolvedValueOnce({
		...old,
		items: [{ scopeKey: 'k', opaqueScopeKey: nextOpaque, text: 'new' }]
	});
	act(() => auth.listener?.());
	await waitFor(() =>
		expect(result.current[0]?.params?.forcedScopeKey).toBe(nextOpaque)
	);
});
