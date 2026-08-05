// @vitest-environment jsdom
// The api layer reads `window` at module load, so this cannot run under node.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { performLeaveQueueDelete } from './leaveQueueDelete';
import { apiFinishAnonymousConversation } from '../../api/apiFinishAnonymousConversation';
import { FETCH_ERRORS } from '../../api/fetchData';
import { logout } from '../logout/logout';

vi.mock('../../api/apiFinishAnonymousConversation', () => ({
	apiFinishAnonymousConversation: vi.fn()
}));

vi.mock('../logout/logout', () => ({
	logout: vi.fn()
}));

describe('performLeaveQueueDelete', () => {
	let onFailure: () => void;

	beforeEach(() => {
		onFailure = vi.fn();
		vi.mocked(apiFinishAnonymousConversation).mockResolvedValue(undefined);
		vi.mocked(logout).mockResolvedValue(undefined);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('finishes the conversation and signs the asker out', async () => {
		await performLeaveQueueDelete(42, { onFailure });

		expect(apiFinishAnonymousConversation).toHaveBeenCalledWith(42);
		expect(logout).toHaveBeenCalledTimes(1);
		expect(onFailure).not.toHaveBeenCalled();
	});

	/**
	 * A 409 means the conversation was already finished — by the counsellor, or
	 * by a double tap racing itself. Either way the asker got what they asked
	 * for, so it must not be reported as a failure.
	 */
	it('treats an already finished conversation as success', async () => {
		vi.mocked(apiFinishAnonymousConversation).mockRejectedValueOnce(
			new Error(FETCH_ERRORS.CONFLICT)
		);

		await performLeaveQueueDelete(42, { onFailure });

		expect(logout).toHaveBeenCalledTimes(1);
		expect(onFailure).not.toHaveBeenCalled();
	});

	/**
	 * Signing out after a real failure would leave the asker believing their
	 * access was gone while the Keycloak account is still live.
	 */
	it('keeps the asker signed in when ending the conversation fails', async () => {
		vi.mocked(apiFinishAnonymousConversation).mockRejectedValueOnce(
			new Error(FETCH_ERRORS.CATCH_ALL)
		);

		await performLeaveQueueDelete(42, { onFailure });

		expect(logout).not.toHaveBeenCalled();
		expect(onFailure).toHaveBeenCalledTimes(1);
	});

	it('reports a failure for a rejection that is not an Error', async () => {
		vi.mocked(apiFinishAnonymousConversation).mockRejectedValueOnce('boom');

		await performLeaveQueueDelete(42, { onFailure });

		expect(logout).not.toHaveBeenCalled();
		expect(onFailure).toHaveBeenCalledTimes(1);
	});

	/**
	 * Without a session id there is nothing to finish, so there is no way to
	 * deactivate the access — logging out anyway would look like success while
	 * the account stays active.
	 */
	it.each([
		['undefined', undefined],
		['null', null],
		['an empty string', '']
	])(
		'does nothing but report failure when the session id is %s',
		async (_label, sessionId) => {
			await performLeaveQueueDelete(
				sessionId as number | string | null | undefined,
				{ onFailure }
			);

			expect(apiFinishAnonymousConversation).not.toHaveBeenCalled();
			expect(logout).not.toHaveBeenCalled();
			expect(onFailure).toHaveBeenCalledTimes(1);
		}
	);
});
