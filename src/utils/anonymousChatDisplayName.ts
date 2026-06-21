/**
 * Resolves the visible name for anonymous live-chat participants.
 * Matrix usernames stay "Anonymous-<timestamp>"; the animal pseudonym
 * lives in displayName after the asker confirms their selection.
 */

export const isAnonymousMatrixUsername = (username?: string): boolean => {
	const value = (username || '').trim();
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
