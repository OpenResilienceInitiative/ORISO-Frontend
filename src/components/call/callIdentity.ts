/**
 * What the call is told about a person, and who decides it.
 *
 * The handoff's first rule is that identity in the call is inherited, never
 * derived: the same animal, the same circle colour and the same ink a person
 * carries everywhere else in ORISO. The call surface gets no vote.
 *
 *   "Du musst einfach die Icons, wie sie sind, reinladen. Das heisst, nicht
 *    du definierst die im Call. Du bist da immer quasi der, der das erbt."
 *
 * The fork cannot work this out for itself. The animal is a stored choice
 * (`avatarKind` / `avatarId`, from the userservice), the colours for an
 * advice seeker come from the user id through the anonymous-name engine, and
 * a counsellor's come from the tenant's brand pair. None of that is visible
 * from inside the iframe.
 *
 * So ORISO publishes it. One small ENCRYPTED TIMELINE EVENT per person per
 * room, sent by that person's own client and read by everybody, keyed on the
 * other side by its sender. Not room state, which was the second plan: state
 * events are not encrypted even in an encrypted room, so an identity in state
 * is a record the homeserver and every server it federates to can read — on
 * this platform, which advice seeker chose which animal. Not the MatrixRTC
 * membership either, which was the first plan and does not work:
 * `MembershipManager.makeMyMembership` in matrix-js-sdk is `protected` and
 * builds its content from a fixed literal, and `joinRoomSession` constructs
 * the manager itself, so there is no hook for an extra field short of
 * patching the SDK.
 *
 * This module is the pure half: one function from what ORISO knows to what
 * travels. The sending lives next door.
 */
import {
	type AvatarChoice,
	chosenAvatarOf,
	counsellorChoiceOf
} from '../../utils/avatarChoice';
import { generateAvatarForUser } from '../../utils/pseudonymGenerator';
import { counsellorInitials } from '../../utils/counsellorAvatar';
import { LANGUAGE_DATA } from '../../utils/anonName/data';

/** The timeline event that carries it. Mirrored in the fork. */
export const CALL_IDENTITY_EVENT_TYPE = 'org.oriso.call.identity';

export interface CallIdentity {
	/** `animal` and `motif` carry artwork; `initials` carries letters. */
	kind: 'animal' | 'motif' | 'initials';
	/** The artwork's file name, e.g. `fox.svg`. Absent for initials. */
	file?: string;
	/** The circle's colour, as a hex literal. */
	bg: string;
	/** The colour the artwork is painted in, as a hex literal. */
	ink: string;
	/** One or two letters, for the initials kind. */
	initials?: string;
	/**
	 * What this person is CALLED, by the name the chat already uses.
	 *
	 * Inherited for the same reason the animal is, and for a reason of its
	 * own: the call has no other source for a name. Element Call reads
	 * `RoomMember.name`, matrix-js-sdk answers that with the user id for a
	 * profile that has none, and an ORISO account has none — the pseudonym
	 * lives in the userservice and is never written to the homeserver. So
	 * every tile in the live walkthrough of 22 October was labelled
	 * `@cyrus:oriso.org`.
	 *
	 * Writing it to the Matrix profile instead would have been the smaller
	 * change and the wrong one: a profile display name is server-visible and
	 * federates, so it would publish the pseudonym permanently in order to
	 * close the leak temporarily. This event is already encrypted and already
	 * carries exactly this kind of fact.
	 *
	 * Composed by `formatMessagePersonName` with NO legal name supplied —
	 * ADR-002 §2 and `resolveIncomingConsultantNameForAsker`: a counsellor's
	 * real name is staff data, and the advice seeker is in this call.
	 *
	 * Never the login name (call design S1): a person without a public
	 * display name is called by their role (counsellor) or by their animal
	 * (advice seeker). Element Call otherwise falls back to the local part of
	 * the Matrix id, which on dev read `krusty.clown_at_openresilience.cc`.
	 */
	name?: string;
	/**
	 * Which side of the counselling this person is on (call design S1).
	 *
	 * Lets the call label a counsellor by role and an advice seeker as
	 * anonymous without ever reading a username. The fork ignores fields it
	 * does not know, so an older call keeps working.
	 */
	role?: CallIdentityRole;
}

export type CallIdentityRole = 'counsellor' | 'asker';

/** What a counsellor without a public display name is called in the call. */
export const DEFAULT_COUNSELLOR_ROLE_NAME = 'Beratung';

export interface BrandPair {
	/** Resolved `--m3-primary`. */
	primary: string;
	/** Resolved `--m3-on-primary`. */
	onPrimary: string;
}

export interface IdentitySource {
	/** The id the palette is derived from — the Matrix user id in practice. */
	userId: string;
	/** Stored avatar metadata, plus whatever the initials are built from. */
	userData: Parameters<typeof chosenAvatarOf>[0] & {
		displayName?: string;
		firstName?: string;
		lastName?: string;
		userName?: string;
	};
	isConsultant: boolean;
	brand: BrandPair;
	/** The role name for a counsellor without a public name; defaults to "Beratung". */
	counsellorRoleName?: string;
}

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * A value that is an account handle rather than a name: a Matrix id, an
 * e-mail address, its `_at_` Matrix spelling, an encoded anonymous name or
 * a historical `Anonymous-` / `anon_` login. None of these may reach a tile.
 */
const LOGIN_LIKE = /@|_at_|^enc\.|^Anonymous-|^anon_/i;

/** The public display name, or '' when there is none worth showing. */
export const cleanCallDisplayName = (raw?: string | null): string => {
	const value = (raw ?? '').replace(/\s+/g, ' ').trim();
	if (!value || LOGIN_LIKE.test(value)) return '';
	return value;
};

/** `fox.svg` → `Fuchs`, from the German word table the pseudonyms come from. */
const GERMAN_ANIMAL_LABELS: ReadonlyMap<string, string> = new Map(
	(LANGUAGE_DATA.de?.groups ?? [])
		.flatMap((group) => group.animals)
		.map((animal) => [animal.svg, animal.label] as const)
);

/** The animal's name for an artwork file; '' when the file is unknown. */
export const animalNameOf = (file: string | undefined): string =>
	(file && GERMAN_ANIMAL_LABELS.get(file)) || '';

/**
 * One person's identity, composed exactly as the chat composes it.
 *
 * The three branches mirror `UserAvatar` and `CounsellorAvatar`: a
 * counsellor's pick becomes a motif on the tenant's brand pair, a counsellor
 * without a pick becomes initials on the same pair, and an advice seeker gets
 * their animal on the palette colour their user id derives. A seeker who
 * picked an animal keeps the derived colours and only swaps the file —
 * `UserAvatar` does the same, and it matters: the colour is what makes the
 * same person recognisable across screens.
 *
 * Pure. The brand pair is passed in rather than read off the document,
 * because a function that reaches for `getComputedStyle` cannot be tested
 * and cannot be reasoned about from its arguments.
 */
export function ownCallIdentity({
	userId,
	userData,
	isConsultant,
	brand,
	counsellorRoleName
}: IdentitySource): CallIdentity {
	const stored = chosenAvatarOf(userData);
	const choice: AvatarChoice | null = isConsultant
		? counsellorChoiceOf(stored)
		: stored;

	/*
	 * The published name, and only the published name: never the legal
	 * name (ADR-002 §2, the advice seeker is in this call).
	 */
	/*
	 * Call design S1: the login name is no longer a fallback. It used to be
	 * the second argument here, and a counsellor without a public name went
	 * into the call as `krusty.clown_at_openresilience.cc`. Now the public
	 * name is the only name taken from the profile; without one a
	 * counsellor is called by their role and an advice seeker by their
	 * animal, decided below once the animal is known.
	 */
	const publicName = cleanCallDisplayName(userData.displayName);
	const role: CallIdentityRole = isConsultant ? 'counsellor' : 'asker';
	const counsellorName = (): { name?: string; role: CallIdentityRole } => ({
		name:
			publicName ||
			cleanCallDisplayName(counsellorRoleName) ||
			DEFAULT_COUNSELLOR_ROLE_NAME,
		role
	});
	const askerName = (
		file: string | undefined
	): { name?: string; role: CallIdentityRole } => {
		const name = publicName || animalNameOf(file);
		return name ? { name, role } : { role };
	};

	const nameFor = (file: string | undefined) =>
		isConsultant ? counsellorName() : askerName(file);

	const derived = generateAvatarForUser(userId);
	// A brand pair that did not resolve — no theme applied yet, or a
	// stylesheet that has not loaded — would travel as the empty string and
	// be rejected at the other end. Falling back to the derived palette keeps
	// the person visible in their own colour instead of invisible in none.
	const branded: BrandPair = {
		primary: HEX.test(brand.primary.trim())
			? brand.primary.trim()
			: derived.bg,
		onPrimary: HEX.test(brand.onPrimary.trim())
			? brand.onPrimary.trim()
			: derived.iconColor
	};

	if (choice?.kind === 'motif')
		return {
			kind: 'motif',
			file: choice.file,
			bg: branded.primary,
			ink: branded.onPrimary,
			...nameFor(choice.file)
		};

	if (choice?.kind === 'initials')
		return {
			kind: 'initials',
			bg: branded.primary,
			ink: branded.onPrimary,
			initials: counsellorInitials({
				displayName: userData.displayName,
				firstName: userData.firstName,
				lastName: userData.lastName,
				username: userData.userName
			}),
			...nameFor(undefined)
		};

	const file = choice?.kind === 'animal' ? choice.file : derived.file;
	return {
		kind: 'animal',
		file,
		bg: derived.bg,
		ink: derived.iconColor,
		...nameFor(file)
	};
}

/** True when two records say the same thing, so an unchanged one is not resent. */
export function sameCallIdentity(
	a: CallIdentity | null | undefined,
	b: CallIdentity | null | undefined
): boolean {
	if (!a || !b) return a === b;
	return (
		a.kind === b.kind &&
		a.file === b.file &&
		a.bg === b.bg &&
		a.ink === b.ink &&
		a.initials === b.initials &&
		// Without this a renamed person kept the old tag for the rest of the
		// call: the publisher skips an identity it considers unchanged.
		a.name === b.name
	);
}
