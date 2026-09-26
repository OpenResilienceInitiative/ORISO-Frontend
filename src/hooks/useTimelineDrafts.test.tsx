// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useTimelineDrafts } from './useTimelineDrafts';
import { apiFetchUserDrafts } from '../api/apiUserDrafts';
import { DRAFTS_UPDATED_EVENT } from '../services/draftStore';

vi.mock('../api/apiUserDrafts', () => ({ apiFetchUserDrafts: vi.fn() }));

afterEach(() => {
	cleanup();
	vi.mocked(apiFetchUserDrafts).mockReset();
});

it('lists open drafts and drops one once it is sent (#1535)', async () => {
	vi.mocked(apiFetchUserDrafts).mockResolvedValue({
		items: [
			{ scopeKey: 'k', text: 'x', updatedAt: '2026-09-07T00:00:00Z' }
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
			{ scopeKey: 'k', text: 'x', updatedAt: '2026-09-07T00:00:00Z' }
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
