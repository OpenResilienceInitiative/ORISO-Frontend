import { apiGetAnonymousEnquiryDetails } from '../../api/apiGetAnonymousEnquiryDetails';

/**
 * Remember which anonymous session an invite link already produced, so a
 * second visit through the same link does not mint a second one.
 *
 * A Live Chat invite link is reusable by design: every redeem creates a fresh
 * anonymous account and a fresh session in the topic queue. That is right for
 * two different guests and wrong for one guest who reloads — the abandoned
 * session stays in the queue, and the guest ends up counted as a person
 * waiting ahead of themselves (#1404).
 *
 * Nothing new about the guest is stored: the tokens for that very session are
 * already in the browser (`setTokens`), this only records which session they
 * belong to. Cleared as soon as the session turns out to be gone.
 */
const STORAGE_PREFIX = 'oriso.invite.session.';

const storageKey = (token: string): string => `${STORAGE_PREFIX}${token}`;

/** Storage access throws in private modes and with site data blocked. */
const safely = <T>(read: () => T, fallback: T): T => {
	try {
		return read();
	} catch {
		return fallback;
	}
};

export const rememberInviteSession = (
	token: string,
	sessionId: number
): void => {
	safely(
		() => localStorage.setItem(storageKey(token), String(sessionId)),
		undefined
	);
};

export const forgetInviteSession = (token: string): void => {
	safely(() => localStorage.removeItem(storageKey(token)), undefined);
};

export const readRememberedInviteSession = (token: string): number | null => {
	const raw = safely(() => localStorage.getItem(storageKey(token)), null);
	if (!raw) {
		return null;
	}
	const sessionId = Number(raw);
	return Number.isInteger(sessionId) && sessionId > 0 ? sessionId : null;
};

/**
 * The session this link already opened, if it is still usable — otherwise
 * `null`, and the caller redeems a fresh one.
 *
 * "Still usable" is answered by the server, not by what the browser remembers:
 * the details endpoint only answers for the session's own advice seeker, so a
 * reply at all proves the stored credentials still belong to this session.
 * DONE and IN_ARCHIVE mean the conversation is over — a new one is what the
 * guest wants. Any failure (expired tokens, deleted session, backend down)
 * falls back to redeeming, which is the behaviour this repo had before: the
 * guest always gets into a room.
 */
export const resolveReusableInviteSession = async (
	token: string
): Promise<number | null> => {
	const sessionId = readRememberedInviteSession(token);
	if (sessionId === null) {
		return null;
	}

	try {
		const details = await apiGetAnonymousEnquiryDetails(sessionId);
		if (details?.status === 'DONE' || details?.status === 'IN_ARCHIVE') {
			forgetInviteSession(token);
			return null;
		}
		return sessionId;
	} catch {
		forgetInviteSession(token);
		return null;
	}
};
