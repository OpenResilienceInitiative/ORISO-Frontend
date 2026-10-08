import { ALL_ANIMAL_FILES } from './pseudonymGenerator';
import type { UserDataInterface } from '../globalState/interfaces';

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

export interface AvatarChoice {
	file: string;
	/** Counsellor motifs sit on primary / on-primary, like in Admin. */
	onPrimary: boolean;
}

/**
 * What the user picked in their profile (#1240), or null for the default the
 * app derives from the user id. Only counsellors carry `avatarKind`, and they
 * have a motif only with ICON.
 */
export const chosenAvatarOf = (
	userData?: Pick<UserDataInterface, 'avatarKind' | 'avatarId'> | null
): AvatarChoice | null => {
	if (userData?.avatarKind) {
		const motif =
			userData.avatarKind === 'ICON'
				? avatarFileOfId(userData.avatarId)
				: null;
		return motif ? { file: motif, onPrimary: true } : null;
	}
	const animal = avatarFileOfId(userData?.avatarId);
	return animal ? { file: animal, onPrimary: false } : null;
};
