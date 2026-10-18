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
}

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
}

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

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
	brand
}: IdentitySource): CallIdentity {
	const stored = chosenAvatarOf(userData);
	const choice: AvatarChoice | null = isConsultant
		? counsellorChoiceOf(stored)
		: stored;

	// A brand pair that did not resolve — no theme applied yet, or a
	// stylesheet that has not loaded — would travel as the empty string and
	// be rejected at the other end. Falling back to the derived palette keeps
	// the person visible in their own colour instead of invisible in none.
	const derived = generateAvatarForUser(userId);
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
			ink: branded.onPrimary
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
			})
		};

	return {
		kind: 'animal',
		file: choice?.kind === 'animal' ? choice.file : derived.file,
		bg: derived.bg,
		ink: derived.iconColor
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
		a.initials === b.initials
	);
}
