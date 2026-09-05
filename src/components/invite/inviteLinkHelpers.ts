import { setTokens } from '../auth/auth';
import { generateCsrfToken } from '../../utils/generateCsrfToken';
import { RedeemInviteLinkSessionResponse } from '../../api/apiRedeemInviteLink';
import { apiPutSessionData } from '../../api/apiPutSessionData';
import { generatePseudonym } from '../../utils/anonName/engine';

export const buildInviteSessionAppUrl = (sessionId: number | string): string =>
	`${window.location.origin}/sessions/user/view/session/${sessionId}`;

/** Apply the identity credentials returned by the invite redeem endpoint. */
export const applyRedeemSessionCredentials = (
	data: RedeemInviteLinkSessionResponse
): void => {
	setTokens(
		data.accessToken,
		data.expiresIn,
		data.refreshToken,
		data.refreshExpiresIn
	);
	generateCsrfToken(true);
};

export const redirectToInviteSession = (
	data: RedeemInviteLinkSessionResponse
): void => {
	window.location.href = buildInviteSessionAppUrl(data.sessionId);
};

/**
 * Give the guest an animal display name for a server-created invite session.
 *
 * A Live Chat link is redeemed server-side: the backend mints the account
 * itself (`anon_1`, `anon_2`, … from AnonymousUsernameRegistry) and hands back
 * tokens, so the pseudonym the legacy branch rolls client-side is never
 * reached. Nothing else fills the gap — no display name is set anywhere for
 * these accounts — and the counsellor ends up looking at `anon_N` for every
 * guest in the queue.
 *
 * The User-ID stays exactly as the backend minted it: it is the identity
 * anchor and the registry's uniqueness key. Only the human-facing name is
 * added, which is where the animal name is meant to live.
 *
 * Best-effort by design. The name is a courtesy, the session is not: if the
 * write fails the guest still gets their chat, and the resolver falls back to
 * the raw User-ID.
 */
export const assignInviteSessionDisplayName = async (
	data: RedeemInviteLinkSessionResponse,
	locale: string
): Promise<string | null> => {
	try {
		const { displayName } = generatePseudonym(locale);
		await apiPutSessionData(data.sessionId, { displayName });
		return displayName;
	} catch {
		return null;
	}
};
