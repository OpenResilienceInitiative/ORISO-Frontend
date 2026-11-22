/**
 * Who is in the supervision side room, and how each person is shown
 * (ORISO-Frontend#2344).
 *
 * The header stack and the side-room messages must show the SAME person the
 * same way: one name, one role, one avatar. Before this module the header
 * read the bare Matrix members — login names, no avatar choice — while the
 * messages drew the counsellor's motif and a role glyph for the supervisor,
 * so nobody could match the header to the conversation.
 *
 * Name rule (internal surface, never shown to advice seekers):
 *   1. the backend #996 name (internal display name → public display name),
 *   2. when that is only the login (the backend's last fallback), the name
 *      from the agency roster — the one the "Manage people" dialog already
 *      shows the same counsellors and supervisors — marked with the login's
 *      domain when two roster entries carry that name,
 *   3. otherwise the decoded login; never an `enc.` user name.
 *
 * Avatar rule: the counsellor rule of the chat (`counsellorChoiceOf`) — the
 * chosen motif, otherwise initials. Pure: no React, no DOM.
 */
import {
	avatarIdOfFile,
	chosenAvatarOf,
	counsellorChoiceOf,
	type AvatarChoice,
	type AvatarIdentity
} from '../../utils/avatarChoice';
import { decodeUsernameSafely } from '../../utils/encryptionHelpers';
import type { StackParticipant } from '../message/participantStack';

export type SupervisionPersonRole = 'consultant' | 'supervisor';

export interface SupervisionPersonSource {
	matrixUserId: string;
	role: SupervisionPersonRole;
	/** Keycloak id — the key into the agency roster. */
	consultantId?: string | null;
	/** Backend #996 name: internal display name, else display name, else login. */
	internalName?: string | null;
	/** Chosen avatar, when known (session DTO, own user data). */
	identity?: AvatarIdentity | null;
}

export interface SupervisionRosterEntry {
	consultantId: string;
	firstName?: string | null;
	lastName?: string | null;
	displayName?: string | null;
}

export interface SupervisionPerson {
	matrixUserId: string;
	role: SupervisionPersonRole;
	name: string;
	firstName?: string;
	lastName?: string;
	choice: Exclude<AvatarChoice, { kind: 'animal' }>;
}

export type SupervisionPeople = ReadonlyMap<string, SupervisionPerson>;

export type SupervisionRoleLabels = Record<SupervisionPersonRole, string>;

const clean = (value: string | null | undefined) => (value ?? '').trim();

/** `@mona.simpson_at_trail.ist:host` → `mona.simpson_at_trail.ist`. */
const localpartOf = (matrixUserId: string) =>
	clean(matrixUserId).replace(/^@/, '').split(':')[0];

/** The login behind a Matrix id, readable: `mona.simpson@trail.ist`. */
const loginOf = (matrixUserId: string) =>
	localpartOf(matrixUserId).replace(/_at_/, '@');

const domainOf = (matrixUserId: string) => {
	const login = loginOf(matrixUserId);
	const at = login.lastIndexOf('@');
	return at > 0 ? login.slice(at + 1) : '';
};

/** A name that is only the account's login, encoded or not. */
const isLoginName = (name: string, matrixUserId: string) => {
	const lower = name.toLowerCase();
	return (
		lower.startsWith('enc.') ||
		lower === localpartOf(matrixUserId).toLowerCase() ||
		lower === loginOf(matrixUserId).toLowerCase()
	);
};

const fullNameOf = (entry: SupervisionRosterEntry | undefined) =>
	[clean(entry?.firstName), clean(entry?.lastName)].filter(Boolean).join(' ');

export const readableSupervisionName = ({
	source,
	roster
}: {
	source: SupervisionPersonSource;
	roster: readonly SupervisionRosterEntry[];
}): string => {
	const internal = clean(source.internalName);
	if (internal && !isLoginName(internal, source.matrixUserId)) {
		return internal;
	}
	const entry = source.consultantId
		? roster.find(
				({ consultantId }) => consultantId === source.consultantId
			)
		: undefined;
	const rosterDisplay = clean(entry?.displayName);
	if (rosterDisplay && !isLoginName(rosterDisplay, source.matrixUserId)) {
		return rosterDisplay;
	}
	const fullName = fullNameOf(entry);
	if (fullName) {
		const namesakes = roster.filter(
			(other) => fullNameOf(other) === fullName
		).length;
		const domain = domainOf(source.matrixUserId);
		return namesakes > 1 && domain ? `${fullName} (${domain})` : fullName;
	}
	const login = internal.startsWith('enc.')
		? clean(decodeUsernameSafely(internal)).replace(/_at_/, '@')
		: '';
	return login || loginOf(source.matrixUserId) || internal;
};

export const resolveSupervisionPeople = ({
	sources,
	roster
}: {
	sources: readonly SupervisionPersonSource[];
	roster: readonly SupervisionRosterEntry[];
}): SupervisionPeople => {
	const people = new Map<string, SupervisionPerson>();
	sources.forEach((source) => {
		if (!clean(source.matrixUserId)) return;
		const known = people.get(source.matrixUserId);
		// A supervisor of this case is shown as supervisor, even when another
		// source lists the same person as counsellor.
		if (known && known.role === 'supervisor') return;
		const entry = source.consultantId
			? roster.find(
					({ consultantId }) => consultantId === source.consultantId
				)
			: undefined;
		people.set(source.matrixUserId, {
			matrixUserId: source.matrixUserId,
			role: source.role,
			name: readableSupervisionName({ source, roster }),
			firstName: clean(entry?.firstName) || undefined,
			lastName: clean(entry?.lastName) || undefined,
			// A source without avatar data keeps what an earlier one knew.
			choice:
				source.identity || !known
					? counsellorChoiceOf(chosenAvatarOf(source.identity))
					: known.choice
		});
	});
	return people;
};

/** The stack stores a choice as `avatarKind`/`avatarId`, like the DTOs. */
const identityOfChoice = (
	choice: SupervisionPerson['choice']
): Required<AvatarIdentity> =>
	choice.kind === 'motif'
		? { avatarKind: 'ICON', avatarId: avatarIdOfFile(choice.file) }
		: { avatarKind: 'INITIALS', avatarId: null };

/** The header stack's people, named and drawn like their messages. */
export const enrichSupervisionParticipants = (
	participants: readonly StackParticipant[],
	people: SupervisionPeople,
	roleLabels: SupervisionRoleLabels
): StackParticipant[] =>
	participants.map((participant) => {
		const person = people.get(participant.userId);
		if (!person) return participant;
		return {
			...participant,
			displayName: person.name,
			firstName: person.firstName,
			lastName: person.lastName,
			roleLabel: roleLabels[person.role],
			...identityOfChoice(person.choice)
		};
	});
