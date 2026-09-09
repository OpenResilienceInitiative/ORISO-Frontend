// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiDeleteUserDraft, apiUpsertUserDraft } from './apiUserDrafts';
import { fetchData } from './fetchData';
import { DRAFTS_UPDATED_EVENT } from '../services/draftStore';
vi.mock('./fetchData', () => ({
	fetchData: vi.fn(),
	FETCH_ERRORS: { CATCH_ALL: 'catch' },
	FETCH_METHODS: { GET: 'get', PATCH: 'patch', DELETE: 'delete' },
	FETCH_SUCCESS: { CONTENT: 'content' }
}));
afterEach(() => vi.restoreAllMocks());
describe('draft mutation refresh', () => {
	it('announces successful save and deletion without exposing draft contents', async () => {
		vi.mocked(fetchData).mockResolvedValue(undefined);
		const dispatch = vi.spyOn(window, 'dispatchEvent');
		await apiUpsertUserDraft('draft-key', { text: 'private ciphertext' });
		await apiDeleteUserDraft('draft-key');
		expect(dispatch.mock.calls.map(([event]) => event.type)).toEqual([
			DRAFTS_UPDATED_EVENT,
			DRAFTS_UPDATED_EVENT
		]);
		expect(dispatch.mock.calls[0][0]).toBeInstanceOf(Event);
		expect('detail' in dispatch.mock.calls[0][0]).toBe(false);
	});
	it('does not announce a failed save as a completed draft', async () => {
		vi.mocked(fetchData).mockRejectedValue(new Error('offline'));
		const dispatch = vi.spyOn(window, 'dispatchEvent');
		await apiUpsertUserDraft('draft-key', { text: 'private ciphertext' });
		expect(dispatch).not.toHaveBeenCalled();
	});
});
