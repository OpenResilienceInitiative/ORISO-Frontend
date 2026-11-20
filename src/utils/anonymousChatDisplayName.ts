/**
 * Resolves the visible name for anonymous live-chat participants.
 * Historical Matrix usernames were "Anonymous-<timestamp>" and later anon_N;
 * new guests get an animal User-ID (ORISO-Frontend#2346). The chosen
 * display name lives in displayName after the asker confirms it.
 */

export const isAnonymousMatrixUsername = (username?: string): boolean => {
	const value = (username || '').trim();
	// Historical accounts only — do not treat animal User-IDs as anonymous.
	return value.startsWith('Anonymous-') || value.startsWith('anon_');
};

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
		if (!isAnonymousMatrixUsername(value)) {
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
