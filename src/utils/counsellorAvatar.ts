/**
 * Counsellor avatar (#1046/#1047) — the counsellor's PUBLIC face, the one an
 * advice seeker sees. Chosen by the counsellor in the admin form or the
 * onboarding wizard and persisted on the consultant as two fields:
 *
 * - `ICON`     — one of the platform's monochrome motifs; `avatarId` is its id
 *                (the file name in `/static/anon-animals`, without `.svg`).
 * - `INITIALS` — the counsellor's initials.
 * - `PICTURE`  — an own uploaded picture. Reserved for #1048/#1049; until that
 *                ships it renders the initials.
 *
 * This is NOT the anonymous advice-seeker avatar. That one is derived from the
 * user id by `generateAvatarForUser` and is an anonymity device with a
 * multi-coloured palette. The counsellor avatar is a deliberate choice and
 * carries the operator's brand: it always renders on the tenant's
 * `--m3-primary-container` surface with the glyph/initials in
 * `--m3-on-primary-container` (owner decision 2026-09-17) — never a colour hash.
 */

export type CounsellorAvatarKind = 'ICON' | 'INITIALS' | 'PICTURE';

/** The stored pair. Both absent = never chose; the caller keeps its old rendering. */
export interface CounsellorAvatarChoice {
	avatarKind?: CounsellorAvatarKind | null;
	avatarId?: string | null;
}

export interface CounsellorNameParts {
	displayName?: string | null;
	firstName?: string | null;
	lastName?: string | null;
	username?: string | null;
}

/**
 * True when the counsellor actually made a choice. Everything else must keep
 * the existing animal rendering — "consultants without a choice render exactly
 * as before, no regression" (#1047).
 */
export const hasCounsellorAvatar = ({
	avatarKind
}: CounsellorAvatarChoice): boolean =>
	avatarKind === 'ICON' || avatarKind === 'INITIALS';

/**
 * What to paint. A stored `ICON` without an id, and the not-yet-built
 * `PICTURE`, both degrade to initials rather than to an empty circle.
 */
export const resolveCounsellorAvatarKind = ({
	avatarKind,
	avatarId
}: CounsellorAvatarChoice): 'ICON' | 'INITIALS' =>
	avatarKind === 'ICON' && (avatarId ?? '').trim().length > 0
		? 'ICON'
		: 'INITIALS';

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

/**
 * Motif id → asset file name. The shipped set is mixed-case on disk
 * (`bear.svg`, but `Nightingale.svg`), and the Admin picker stores the
 * lower-case id, so the lookup is case-insensitive against a known list.
 * An id outside the set returns null and the caller falls back to initials —
 * an unknown file would otherwise fetch-404 into an empty circle.
 */
export const counsellorMotifFile = (
	avatarId: string | null | undefined,
	availableFiles: readonly string[]
): string | null => {
	const id = (avatarId ?? '').trim().toLowerCase();
	if (!id) {
		return null;
	}
	return (
		availableFiles.find(
			(file) => file.replace(/\.svg$/i, '').toLowerCase() === id
		) ?? null
	);
};
