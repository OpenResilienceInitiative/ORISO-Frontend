import {
	GroupChatItemInterface,
	ListItemInterface,
	SessionItemInterface
} from '../../globalState/interfaces/SessionsDataInterface';

/**
 * The four conversation modalities (ADR-006 / CONTEXT-conversation-types).
 *
 * Modality answers "what kind of conversation is this" and is orthogonal to the lifecycle status
 * (Enquiry → Active → Finished → Archived). The two must never be merged into one "type" again.
 */
export enum Modality {
	AGENCY_COUNSELLING = 'AGENCY_COUNSELLING',
	LIVE_CHAT = 'LIVE_CHAT',
	INTERNAL_GROUP = 'INTERNAL_GROUP',
	SELF_HELP = 'SELF_HELP'
}

const REGISTRATION_TYPE_ANONYMOUS = 'ANONYMOUS';

const isModality = (value: unknown): value is Modality =>
	typeof value === 'string' &&
	(Object.values(Modality) as string[]).includes(value);

/**
 * The single source of truth for a conversation's modality on the frontend.
 *
 * ADR-006 Step 1: every modality decision must go through this one pure selector instead of
 * re-deriving the kind from scattered booleans (registrationType, teamSession, repetitive, …) at
 * the ~90 call sites that are the documented root cause of the recurring "touching the live chat
 * makes the chat go fuzzy" regressions.
 *
 * It prefers an explicit backend `conversationType` once that field is populated (ADR-006 target
 * state) and falls back to the existing heuristic while it is rolled out. The fallback order is
 * significant: a group `chat` is checked before `teamSession`, which is checked before the
 * anonymous (live-chat) signal, so an internal group is never mislabelled as agency counselling.
 */
export const getModality = (item?: ListItemInterface): Modality => {
	const session = item?.session as
		| (SessionItemInterface & {
				teamSession?: boolean;
				conversationType?: string;
		  })
		| undefined;
	const chat = item?.chat as
		| (GroupChatItemInterface & { conversationType?: string })
		| undefined;

	// 1. An explicit backend modality wins once it is populated (ADR-006 target state).
	const explicit = session?.conversationType ?? chat?.conversationType;
	if (isModality(explicit)) {
		return explicit;
	}

	// 2. Fallback heuristic (centralised here, deleted once the column is populated everywhere).
	if (chat) {
		return chat.repetitive ? Modality.SELF_HELP : Modality.INTERNAL_GROUP;
	}
	if (session) {
		if (session.teamSession === true) {
			return Modality.INTERNAL_GROUP;
		}
		if ((session.registrationType as string) === REGISTRATION_TYPE_ANONYMOUS) {
			return Modality.LIVE_CHAT;
		}
		return Modality.AGENCY_COUNSELLING;
	}

	return Modality.AGENCY_COUNSELLING;
};
