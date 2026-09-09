// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useTimelineDrafts } from './useTimelineDrafts';
import { apiGetUserDrafts } from '../api/apiUserDrafts';
import {
	DRAFTS_UPDATED_EVENT,
	REMOTE_DRAFT_INDEX_SCOPE
} from '../services/draftStore';
vi.mock('../api/apiUserDrafts', () => ({ apiGetUserDrafts: vi.fn() }));
afterEach(cleanup);
it('shows a metadata-only draft with a resume scope and removes it after sending', async () => {
	vi.mocked(apiGetUserDrafts).mockResolvedValue({
		items: [
			{
				scopeKey: 'room:73|thread:main',
				text: 'secret ciphertext',
				actionPath: '/sessions/user/view/73',
				updatedAt: '2026-09-07T00:00:00Z'
			}
		],
		page: 0,
		perPage: 200
	});
	const { result } = renderHook(() => useTimelineDrafts());
	await waitFor(() => expect(result.current).toHaveLength(1));
	expect(result.current[0]).toMatchObject({
		eventType: 'draft.created',
		text: '',
		title: '',
		readAt: '2026-09-07T00:00:00Z'
	});
	expect(result.current[0].actionPath).toBe(
		'/sessions/user/view/73?draftScopeKey=room%3A73%7Cthread%3Amain'
	);
	expect(JSON.stringify(result.current)).not.toContain('secret');
	vi.mocked(apiGetUserDrafts).mockResolvedValue({
		items: [],
		page: 0,
		perPage: 200
	});
	act(() => window.dispatchEvent(new Event(DRAFTS_UPDATED_EVENT)));
	await waitFor(() => expect(result.current).toHaveLength(0));
});
describe('draft visibility', () => {
	it('excludes index bookkeeping and empty editors', async () => {
		vi.mocked(apiGetUserDrafts).mockResolvedValue({
			items: [
				{ scopeKey: REMOTE_DRAFT_INDEX_SCOPE, text: 'index' },
				{ scopeKey: 'empty', text: '<p><br></p>' }
			],
			page: 0,
			perPage: 200
		});
		const { result } = renderHook(() => useTimelineDrafts());
		await waitFor(() => expect(apiGetUserDrafts).toHaveBeenCalled());
		expect(result.current).toEqual([]);
	});
});
