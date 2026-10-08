import { ALL_ANIMAL_FILES } from './pseudonymGenerator';

/** The id the backend and Admin store: the lower-case file stem, e.g. `magpie`. */
export const avatarIdOfFile = (file: string): string =>
	file.replace(/\.svg$/i, '').toLowerCase();

/** The app's file for a stored id, or null when the app ships no such animal. */
export const avatarFileOfId = (id?: string | null): string | null =>
	(id &&
		ALL_ANIMAL_FILES.find(
			(file) => avatarIdOfFile(file) === id.toLowerCase()
		)) ||
	null;

/** Admin's counsellor motif set (#1046) is the app's animals without the crane. */
export const COUNSELLOR_MOTIF_FILES = ALL_ANIMAL_FILES.filter(
	(file) => avatarIdOfFile(file) !== 'crane'
);

export interface AvatarIdentity {
	avatarKind?: string | null;
	avatarId?: string | null;
}

export type AvatarChoice =
	| { kind: 'animal'; file: string }
	| { kind: 'motif'; file: string }
	| { kind: 'initials' };

/** Resolve stored avatar metadata once for own and recipient surfaces. */
export const chosenAvatarOf = (
	identity?: AvatarIdentity | null
): AvatarChoice | null => {
	if (identity?.avatarKind === 'INITIALS') return { kind: 'initials' };
	if (identity?.avatarKind === 'ICON') {
		const file = avatarFileOfId(identity.avatarId);
		return file ? { kind: 'motif', file } : { kind: 'initials' };
	}
	if (identity?.avatarKind) return null;
	const file = avatarFileOfId(identity?.avatarId);
	return file ? { kind: 'animal', file } : null;
};
