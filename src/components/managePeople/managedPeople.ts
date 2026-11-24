import { decodeUsername } from '../../utils/encryptionHelpers';

/**
 * One conversation's people, behind one interface. Every chat type answers the
 * same questions (who is in, who could join, what may I change), so the dialog
 * and its state never need to know which endpoints sit behind a source.
 */

export type ManagedPeopleKind = 'supervision' | 'internalChat' | 'groupChat';

export type ManagedPersonRole =
	| 'supervisor'
	| 'owner'
	| 'coModerator'
	| 'participant';

export interface ManagedPerson {
	id: string;
	/** Name for colleagues, already resolved by the source. */
	name: string;
	/** Agency or counselling centre, when the source knows it. */
	organisation?: string;
	role: ManagedPersonRole;
	/** ISO date the person joined, when the source knows it. */
	since?: string;
	/** Why the person is here, e.g. the supervision reason. */
	reason?: string;
	/** Set by the agency admin: can be replaced in the case, never just removed. */
	isStanding?: boolean;
	isSelf?: boolean;
	canRemove: boolean;
	canReplace: boolean;
}

export interface PersonCandidate {
	id: string;
	name: string;
	/** Agency or counselling centre, when the source knows it. */
	organisation?: string;
}

/**
 * The server said no (403/409): the person is no longer allowed here, for
 * example because their organisation withdrew the permission while the list
 * was open. Sources throw this so the dialog can say so instead of "try again".
 */
export class PersonChangeRefusedError extends Error {
	constructor(message = 'refused') {
		super(message);
		this.name = 'PersonChangeRefusedError';
	}
}

export interface ChangePersonInput {
	reason?: string;
	/** #2494 *6: tell the advice seeker about a replacement. */
	notifyClient?: boolean;
}

export interface ManagedPeopleSource {
	kind: ManagedPeopleKind;
	loadMembers: () => Promise<ManagedPerson[]>;
	/** Absent when nobody can be added here. */
	loadCandidates?: () => Promise<PersonCandidate[]>;
	addPerson?: (
		candidate: PersonCandidate,
		input: ChangePersonInput
	) => Promise<void>;
	removePerson?: (person: ManagedPerson) => Promise<void>;
	replacePerson?: (
		person: ManagedPerson,
		candidate: PersonCandidate,
		input: ChangePersonInput
	) => Promise<void>;
	/** Adding or replacing needs a written reason. */
	requiresReason?: boolean;
	/**
	 * #2494 *6: a replacement can tell the advice seeker; the dialog offers
	 * the choice (ticked by default).
	 */
	replaceCanNotifyClient?: boolean;
}

/**
 * Never an encoded `enc.` user name on screen: an older backend or a person
 * without a display name still reads as a name.
 */
export const readablePersonName = (
	displayName?: string | null,
	username?: string | null,
	fallback = ''
): string => {
	const name = displayName?.trim();
	if (name && !name.startsWith('enc.')) {
		return name;
	}
	return decodeUsername(username ?? name ?? '').trim() || fallback;
};

/** Candidates who are not in yet, without duplicates, sorted by name. */
export const selectableCandidates = (
	candidates: PersonCandidate[],
	members: ManagedPerson[],
	locale?: string
): PersonCandidate[] => {
	const taken = new Set(members.map(({ id }) => id));
	const unique = new Map<string, PersonCandidate>();
	candidates.forEach((candidate) => {
		if (!taken.has(candidate.id) && !unique.has(candidate.id)) {
			unique.set(candidate.id, candidate);
		}
	});
	return Array.from(unique.values()).sort((a, b) =>
		a.name.localeCompare(b.name, locale)
	);
};

/** Search by name or organisation, case-insensitive. */
export const matchesPersonSearch = (
	person: Pick<PersonCandidate, 'name' | 'organisation'>,
	query: string
): boolean => {
	const search = query.trim().toLocaleLowerCase();
	if (!search) return true;
	return [person.name, person.organisation].some((text) =>
		text?.toLocaleLowerCase().includes(search)
	);
};
