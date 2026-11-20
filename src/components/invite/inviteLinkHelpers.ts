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
 * Only for a redeem that did not carry a rolled User-ID (the on-arrival
 * fallback): the server then rolls an animal User-ID itself
 * (AnonymousUsernameRegistry) and no display name exists yet. The entry room
 * sends the guest's own roll instead, which becomes the login
 * (ORISO-Frontend#2346).
 *
 * The User-ID stays exactly as the backend created it: it is the identity
 * anchor. Only the human-facing name is added.
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

		let timeoutId: ReturnType<typeof setTimeout> | undefined;
		const storePromise = apiPutSessionData(data.sessionId, { displayName })
			.then(() => true)
			.catch(() => false);
		const timeoutPromise = new Promise<boolean>((resolve) => {
			timeoutId = setTimeout(() => resolve(false), 5_000);
		});
		const stored = await Promise.race([
			storePromise,
			timeoutPromise
		]).finally(() => {
			if (timeoutId !== undefined) {
				clearTimeout(timeoutId);
			}
		});

		return stored ? displayName : null;
	} catch {
		return null;
	}
};
