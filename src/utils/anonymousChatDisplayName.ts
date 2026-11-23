/**
 * Resolves the visible name for anonymous live-chat participants.
 * Historical Matrix usernames were "Anonymous-<timestamp>" and later anon_N;
 * new guests get an animal User-ID (ORISO-Frontend#2346). The chosen
 * display name lives in displayName after the asker confirms it.
 */

const LEGACY_GUEST_LOGIN = /^(?:Anonymous-|anon_)/;

/**
 * Whether a label is a raw historical guest login ("Anonymous-<ts>", anon_N)
 * that should not be shown when a better name exists.
 *
 * LABEL ONLY. This never says whether a person is an anonymous guest — that
 * is the session's registration type or the ANONYMOUS authority
 * (ORISO-Frontend#2347). It is the one place in src/ allowed to look at the
 * prefix; see scripts/contracts/guest-prefix-allowlist.txt.
 */
export const isLegacyGuestLoginLabel = (label?: string | null): boolean =>
	LEGACY_GUEST_LOGIN.test((label || '').trim());

type NameSource = {
	username?: string;
	displayName?: string;
};

/**
 * Prefer a human-readable pseudonym over the raw Anonymous-* username.
 */
export const resolveAnonymousChatDisplayName = (
	participant?: NameSource | null,
	fallbackDisplayName?: string
): string | null => {
	const candidates = [
		participant?.displayName,
		fallbackDisplayName,
		participant?.username
	];

	for (const raw of candidates) {
		const value = (raw || '').trim();
		if (!value) {
			continue;
		}
		if (!isLegacyGuestLoginLabel(value)) {
			return value;
		}
	}

	const last = (participant?.displayName || fallbackDisplayName || '').trim();
	return last || null;
};

/** A saved session alias is literal text, not a Matrix/login identifier. */
export const resolveAssignedAskerDisplayName = (
	participant?: NameSource | null
): string | null => participant?.displayName?.trim() || null;
