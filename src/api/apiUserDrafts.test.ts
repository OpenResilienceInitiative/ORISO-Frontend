// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiDeleteUserDraft, apiUpsertUserDraft } from './apiUserDrafts';
import { fetchData } from './fetchData';
import { DRAFTS_UPDATED_EVENT } from '../services/draftStore';

vi.mock('../resources/scripts/endpoints', () => ({
	endpoints: { userDrafts: '/service/users/drafts' }
}));
vi.mock('./fetchData', () => ({
	fetchData: vi.fn(),
	FETCH_ERRORS: { CATCH_ALL: 'CATCH_ALL', EMPTY: 'EMPTY' },
	FETCH_METHODS: { GET: 'GET', PATCH: 'PATCH', DELETE: 'DELETE' },
	FETCH_SUCCESS: { CONTENT: 'CONTENT' }
}));

afterEach(() => vi.restoreAllMocks());

describe('draft mutations announce themselves (#1535)', () => {
	it('announces a successful save and deletion without the draft content', async () => {
		vi.mocked(fetchData).mockResolvedValue(undefined);
		const dispatch = vi.spyOn(window, 'dispatchEvent');
		await apiUpsertUserDraft('draft-key', { text: 'private ciphertext' });
		await apiDeleteUserDraft('draft-key');
		const events = dispatch.mock.calls.map(([event]) => event);
		expect(events.map((event) => event.type)).toEqual([
			DRAFTS_UPDATED_EVENT,
			DRAFTS_UPDATED_EVENT
		]);
		expect(events.some((event) => 'detail' in event)).toBe(false);
	});

	it('stays silent when the save failed', async () => {
		vi.mocked(fetchData).mockRejectedValue(new Error('offline'));
		const dispatch = vi.spyOn(window, 'dispatchEvent');
		await apiUpsertUserDraft('draft-key', { text: 'private ciphertext' });
		await apiDeleteUserDraft('draft-key');
		expect(dispatch).not.toHaveBeenCalled();
	});
});
