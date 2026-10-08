export interface CounsellorNameParts {
	displayName?: string | null;
	firstName?: string | null;
	lastName?: string | null;
	username?: string | null;
}

/**
 * Up to two upper-case letters, read from the PUBLIC display name first —
 * that is the name shown next to the avatar, so the initials must match it.
 * Empty when nothing is known: an empty tinted circle is honest, a made-up
 * letter is not.
 */
export const counsellorInitials = ({
	displayName,
	firstName,
	lastName,
	username
}: CounsellorNameParts): string => {
	const fromDisplayName = (displayName ?? '').trim();
	const words = fromDisplayName ? fromDisplayName.split(/\s+/) : [];
	const named = [(firstName ?? '').trim(), (lastName ?? '').trim()].filter(
		Boolean
	);
	const source =
		// eslint-disable-next-line no-nested-ternary -- three exclusive sources, read top-down
		words.length > 0
			? words
			: named.length > 0
				? named
				: [(username ?? '').trim()].filter(Boolean);

	return source
		.slice(0, 2)
		.map((word) => [...word][0] ?? '')
		.join('')
		.toLocaleUpperCase();
};
