/**
 * Who may appear in a room's participant stack (ADR-002 silent membership).
 *
 * Every counsellor of the agency is a Matrix member of every session room —
 * technical eligibility for case hand-over and supervision — but that
 * membership is *silent*: the room header, the side-panel header and the
 * "+N" counter must never reveal it. So the visible set is not "the joined
 * members" but a rule per room kind:
 *
 *   - `session` (main room, threads): the advice seeker, the assigned
 *     consultant (`activeSession.consultant`) and the active supervisors;
 *   - `supervision` (side room): the assigned consultant, the supervisors and
 *     me — never the advice seeker;
 *   - `group`: every joined member (group chats have no silent members).
 *
 * Identities reach the client in several spellings: the room gives the
 * Matrix id `@mona.simpson:server` (localpart = the DECODED Keycloak
 * username, lower-cased — `AssignEnquiryFacade` / `MatrixSynapseService`),
 * the session and supervisor DTOs give the base32-ENCODED username
 * `enc.NVXW…` (`UsernameTranscoder`, `UserServiceMapper`), the session DTO
 * also carries `consultantMatrixUserId`, consultant ids are UUIDs (which
 * never match a Matrix id — fallback only), the asker arrives as
 * `askerMatrixUserId`. Matching goes through `participantIdentityKeys`
 * (strict: local part, `enc.` decoded, never fuzzy tokens; see
 * `audienceOptions.ts` for the same rule on the send-to selector).
 *
 * #996: counsellors are named by their internal display name; the rules
 * carry that name and it replaces whatever the Matrix profile says.
 *
 * No React, no DOM.
 */
import type { StackParticipant } from './participantStack';
import { decodeUsername } from '../../utils/encryptionHelpers';

export type VisibleParticipantMode = 'group' | 'session' | 'supervision';

export interface ParticipantIdentity {
	/** Any spelling of the person's id: Matrix id, username, consultant id. */
	ids: (string | null | undefined)[];
	/** Internal display name (#996) — replaces the Matrix profile name. */
	displayName?: string | null;
}

export interface VisibleParticipantRules {
	mode: VisibleParticipantMode;
	asker?: ParticipantIdentity;
	consultant?: ParticipantIdentity | null;
	supervisors: ParticipantIdentity[];
	/** The viewer — visible in the supervision room (counterpart + me). */
	self?: ParticipantIdentity;
}

const ENCODED_PREFIX = 'enc.';

/**
 * The decoded form of an `enc.<base32>` username (lower-cased, so it equals
 * the Matrix localpart), or nothing when the value is not valid base32.
 */
const decodedUsernameOf = (value: string): string | null => {
	if (!value.startsWith(ENCODED_PREFIX)) {
		return null;
	}
	try {
		const decoded = decodeUsername(value).trim().toLowerCase();
		return decoded && decoded !== value ? decoded : null;
	} catch {
		return null;
	}
};

/**
 * Strict identity keys of one raw value: lower-cased, without a leading `@`,
 * the Matrix local part before `:`, the part before an e-mail `@`, and each
 * of those with the `enc.` prefix resolved — base32-decoded when it is a
 * transcoded username, plainly stripped otherwise.
 */
export const participantIdentityKeys = (
	rawValue?: string | null
): Set<string> => {
	const keys = new Set<string>();
	const compact = `${rawValue || ''}`.trim().toLowerCase();
	if (!compact) {
		return keys;
	}
	const add = (value: string) => {
		const normalized = value.trim();
		if (!normalized) {
			return;
		}
		keys.add(normalized);
		if (normalized.startsWith(ENCODED_PREFIX)) {
			keys.add(normalized.slice(ENCODED_PREFIX.length));
			const decoded = decodedUsernameOf(normalized);
			if (decoded) {
				keys.add(decoded);
			}
		}
	};
	add(compact);
	const withoutAt = compact.startsWith('@') ? compact.slice(1) : compact;
	add(withoutAt);
	const localpart = withoutAt.split(':')[0];
	add(localpart);
	// Keycloak usernames may be e-mail shaped; the Matrix localpart is the
	// part before the `@` (Synapse forbids `@` in a localpart).
	add(localpart.split('@')[0]);
	return keys;
};

const keysOf = (values: (string | null | undefined)[]): Set<string> => {
	const keys = new Set<string>();
	values.forEach((value) =>
		participantIdentityKeys(value).forEach((key) => keys.add(key))
	);
	return keys;
};

const matches = (
	participant: StackParticipant,
	identity: ParticipantIdentity | null | undefined
): boolean => {
	if (!identity) {
		return false;
	}
	const wanted = keysOf(identity.ids);
	if (wanted.size === 0) {
		return false;
	}
	const own = keysOf([participant.userId, participant.username]);
	return Array.from(own).some((key) => wanted.has(key));
};

const named = (
	participant: StackParticipant,
	identity: ParticipantIdentity
): StackParticipant =>
	identity.displayName
		? { ...participant, displayName: identity.displayName }
		: participant;

/**
 * The members of `participants` that the rules allow, in caller order, with
 * counsellors renamed to their internal display name. Order and "+N" are
 * `resolveParticipantStack`'s job — apply this first so the counter only
 * ever counts visible people.
 */
export const filterVisibleParticipants = (
	participants: StackParticipant[],
	rules: VisibleParticipantRules
): StackParticipant[] => {
	if (rules.mode === 'group') {
		return participants;
	}
	const allowed: ParticipantIdentity[] = [];
	if (rules.mode === 'session' && rules.asker) {
		allowed.push(rules.asker);
	}
	if (rules.consultant) {
		allowed.push(rules.consultant);
	}
	allowed.push(...rules.supervisors);
	if (rules.mode === 'supervision' && rules.self) {
		allowed.push(rules.self);
	}
	return participants.flatMap((participant) => {
		if (rules.mode === 'supervision' && matches(participant, rules.asker)) {
			return [];
		}
		const identity = allowed.find((candidate) =>
			matches(participant, candidate)
		);
		if (!identity) {
			return [];
		}
		return [
			participant.isAsker ? participant : named(participant, identity)
		];
	});
};
