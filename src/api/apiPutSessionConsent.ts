import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_ERRORS, FETCH_METHODS } from './fetchData';

/**
 * Gate 2 of ADR-022: records which legal-text version this room is cleared for.
 *
 * PUT, not POST, because the pointer is **overwritten** on re-consent — the call is idempotent and
 * repeating it is not consenting twice. There is no consent log and there must not be one
 * (ADR-022 decision 2 rejected a per-user consent event log): nothing about who agreed when is
 * stored, only which version the room is cleared for.
 *
 * Why this exists next to `apiPatchUserData({ dataPrivacyConfirmation: true })` rather than
 * replacing it: the account-level timestamp is version-blind. It records *that* somebody agreed,
 * not *to what*. A Träger publishing new wording would not invalidate an acceptance carried only
 * by the account flag, which is the whole reason ADR-021 gave the legal texts a version history in
 * the first place. Callers that know the version pin it here; the account flag stays as the
 * fallback for rooms and clients that do not.
 *
 * Only the session's own advice seeker may call it — ownership is verified server-side, and a room
 * without a Gate 2 at all (group chats, whose session is owned by a tenant system user) answers
 * 409 rather than 403, so the honest reason reaches the caller.
 */
export const apiPutSessionConsent = (
	sessionId: number | string,
	legalVersionId: number
): Promise<void> =>
	fetchData({
		url: `${endpoints.sessionBase}/${sessionId}/consent`,
		method: FETCH_METHODS.PUT,
		bodyData: JSON.stringify({ legalVersionId }),
		responseHandling: [
			FETCH_ERRORS.BAD_REQUEST,
			FETCH_ERRORS.FORBIDDEN,
			FETCH_ERRORS.CONFLICT,
			FETCH_ERRORS.CATCH_ALL
		]
	});
