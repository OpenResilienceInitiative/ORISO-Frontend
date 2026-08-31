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

type ConversationItem = Partial<SessionItemInterface> &
	Partial<GroupChatItemInterface> & {
		askerUserName?: string;
		conversationType?: string;
		teamSession?: boolean;
	};

type ModalityInput =
	| ListItemInterface
	| {
			item?: ConversationItem | null;
			isGroup?: boolean;
			isSession?: boolean;
			user?: { username?: string | null };
	  };

// Historical accounts: live-chat used to mint Anonymous-<timestamp> handles;
// topic-based invite still uses anon_N. Newer guests get animal User-IDs.
const isAnonymousUsername = (username?: string | null): boolean =>
	typeof username === 'string' &&
	(username.startsWith('Anonymous-') || username.startsWith('anon_'));

const isAnonymousPostcode = (postcode?: number | string | null): boolean => {
	if (postcode === null || postcode === undefined) {
		return false;
	}
	const value = String(postcode).trim();
	return value === '0' || value === '00000';
};

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
export const getModality = (item?: ModalityInput): Modality => {
	const activeSession = item && 'item' in item ? item : undefined;
	const listItem =
		item && !('item' in item) ? (item as ListItemInterface) : undefined;
	const activeItem = activeSession?.item;
	const user = activeSession?.user ?? listItem?.user;
	const session = (
		activeItem && !activeSession?.isGroup ? activeItem : listItem?.session
	) as
		| (SessionItemInterface & {
				askerUserName?: string;
				teamSession?: boolean;
				conversationType?: string;
		  })
		| undefined;
	const chat = (
		activeItem && activeSession?.isGroup ? activeItem : listItem?.chat
	) as (GroupChatItemInterface & { conversationType?: string }) | undefined;

	// 1. An explicit backend modality wins once it is populated (ADR-006 target state).
	const explicit = session?.conversationType ?? chat?.conversationType;
	if (isModality(explicit)) {
		return explicit;
	}

	// 2. Fallback heuristic (centralised here, deleted once the column is populated everywhere).
	if (chat) {
		return chat.repeatCount !== undefined || chat.repetitive
			? Modality.SELF_HELP
			: Modality.INTERNAL_GROUP;
	}
	if (session) {
		if (session.teamSession === true) {
			return Modality.INTERNAL_GROUP;
		}
		if (
			(session.registrationType as string) ===
				REGISTRATION_TYPE_ANONYMOUS ||
			isAnonymousPostcode(session.postcode) ||
			isAnonymousUsername(session.askerUserName) ||
			isAnonymousUsername(user?.username)
		) {
			return Modality.LIVE_CHAT;
		}
		return Modality.AGENCY_COUNSELLING;
	}

	return Modality.AGENCY_COUNSELLING;
};
