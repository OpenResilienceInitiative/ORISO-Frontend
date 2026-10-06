/**
 * Resolves the visible name for anonymous live-chat participants.
 * Historical Matrix usernames were "Anonymous-<timestamp>"; topic-based
 * invite still uses anon_N. The animal display-name lives in displayName
 * after the asker confirms their selection.
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
