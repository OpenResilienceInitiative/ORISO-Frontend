import { apiFinishAnonymousConversation } from '../../api/apiFinishAnonymousConversation';
import { FETCH_ERRORS } from '../../api/fetchData';
import { logout } from '../logout/logout';

export interface LeaveQueueDeleteHandlers {
	/**
	 * Called when the access could not be given up. The caller is expected to
	 * clear its busy flag and surface the error, keeping the confirmation step
	 * reachable for a retry.
	 */
	onFailure: () => void;
}

/**
 * Ends the anonymous conversation and signs the asker out (#893).
 *
 * `finishConversation` is what the advice seeker is authorised to call for
 * their own session, and it runs `DeactivateKeycloakUserActionCommand` on the
 * anonymous account server-side — so the access really is disabled, not merely
 * logged out. `apiDeleteAskerAccount` is not an option here: it needs the
 * generated password, and registration hands over via a full page load, so
 * nothing in the session view still holds it.
 *
 * A 409 means the conversation was already finished (the counsellor ended it,
 * or a double tap raced) — the outcome the user asked for either way, so it is
 * treated as success.
 *
 * Signing out is deliberately conditional on the finish call having happened:
 * logging out without it would leave the asker believing their access was gone
 * while the Keycloak account is still live.
 */
export const performLeaveQueueDelete = async (
	sessionId: number | string | null | undefined,
	{ onFailure }: LeaveQueueDeleteHandlers
): Promise<void> => {
	if (sessionId == null || sessionId === '') {
		onFailure();
		return;
	}

	try {
		await apiFinishAnonymousConversation(sessionId);
	} catch (error: unknown) {
		const alreadyFinished =
			error instanceof Error && error.message === FETCH_ERRORS.CONFLICT;
		if (!alreadyFinished) {
			onFailure();
			return;
		}
	}

	await logout();
};
