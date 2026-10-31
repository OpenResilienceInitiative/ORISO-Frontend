import { getModality, Modality } from '../session/getModality';
import type { ListItemInterface } from '../../globalState/interfaces/SessionsDataInterface';
import type { ExtendedSessionInterface } from '../../globalState/helpers/stateHelpers';
import type { IUserDraftItem } from '../../api/apiUserDrafts';
import { isChatItemUnread } from '../../utils/sessionUnread';
import {
	getSupervisionListState,
	hasSupervisionMarker
} from '../sessionsListItem/supervisionListState';
import { OTHER_KIND_ID } from '../displayFilter/displayFilterTypes';
import type { SessionKindId } from '../../utils/displayFilter/sessions';
import {
	SessionSearchTextOptions,
	sessionMatchesPeople,
	sessionMatchesSearchText
} from './sessionSearchPeople';

export type SessionToolbarChipFilter =
	| 'unread'
	| 'drafts'
	| 'nearby'
	| 'liveChat'
	| 'internalGroup'
	| 'groups'
	| 'supervision'
	| 'other';

export type SessionToolbarGroupSession = {
	isGroup?: boolean;
	item?: {
		conversationType?: `${Modality}`;
		repetitive?: boolean;
	} | null;
};

export const normalizeSessionToolbarChip = (
	chip?: string | null
): SessionToolbarChipFilter | null => {
	switch (chip) {
		case 'neu':
		case 'unread':
			return 'unread';
		case 'oneToOne':
		case 'chats':
		case 'nearby':
			return 'nearby';
		case 'drafts':
			return 'drafts';
		case 'other':
			return 'other';
		case 'liveChat':
			return 'liveChat';
		case 'internal':
		case 'internalGroup':
			return 'internalGroup';
		case 'circles':
			return 'groups';
		case 'groups':
		case 'supervision':
			return chip;
		default:
			return null;
	}
};

// Group chat filters must rely on room metadata, never encrypted message bodies.
export const isConversationCircleSession = (
	session: SessionToolbarGroupSession
): boolean =>
	Boolean(session.isGroup) && getModality(session) === Modality.SELF_HELP;

export const isInternalGroupChatSession = (
	session: SessionToolbarGroupSession
): boolean => Boolean(session.isGroup && !isConversationCircleSession(session));

/**
 * Live-chat / anonymous asker sessions on the registered-enquiry feed.
 */
export function isAnonymousAskerSession(
	raw: ListItemInterface,
	_extended: ExtendedSessionInterface
): boolean {
	return getModality(raw) === Modality.LIVE_CHAT;
}

const isSupervisedByMe = (
	extended: ExtendedSessionInterface,
	currentUserId: string | undefined
): boolean =>
	getSupervisionListState(extended, currentUserId) === 'supervisedByMe';

/**
 * Exactly one kind per row, evaluated in the spec's order (§5.2): supervision
 * by backend marker (only if the viewer can supervise) → circle → internal
 * group → live chat → supervision by legacy fallback (no marker, row owned
 * by another consultant, only if the viewer can supervise) → one-to-one.
 * The legacy heuristic runs after the structural group kinds because it
 * cannot tell a supervised case from a group an eligible consultant merely
 * subscribes to; and never for askers, whose ordinary chats it would
 * otherwise call "supervision".
 *
 * The display filter (`utils/displayFilter/sessions`) and the Supervision
 * chip below both use this one function, so they cannot disagree (#1703).
 */
export const classifySession = (
	raw: ListItemInterface,
	extended: ExtendedSessionInterface,
	currentUserId: string | undefined,
	canSupervise: boolean
): SessionKindId => {
	if (!raw?.session && !raw?.chat) {
		return OTHER_KIND_ID;
	}
	const marker = hasSupervisionMarker(extended);
	if (canSupervise && marker && isSupervisedByMe(extended, currentUserId)) {
		return 'supervision';
	}
	if (isConversationCircleSession(extended)) {
		return 'circle';
	}
	if (isInternalGroupChatSession(extended)) {
		return 'internalGroup';
	}
	if (isAnonymousAskerSession(raw, extended)) {
		return 'liveChat';
	}
	if (
		canSupervise &&
		!marker &&
		raw.consultant?.id &&
		String(raw.consultant.id) !== String(currentUserId || '')
	) {
		return 'supervision';
	}
	return 'oneToOne';
};

/**
 * The chat item behind a list entry (group chat wins over 1:1 session) —
 * same resolution as `getChatItemForSession`, inlined here to keep this
 * module free of the heavy component import graph.
 */
const getToolbarChatItem = (raw: ListItemInterface) =>
	raw.chat ?? raw.session ?? null;

const getSessionIdentityValues = (
	raw: ListItemInterface,
	extended: ExtendedSessionInterface
): string[] => {
	const item = extended.item;
	const values = [
		raw.session?.id,
		raw.chat?.id,
		raw.chat?.matrixRoomId,
		raw.session?.matrixRoomId,
		item?.id,
		item?.matrixRoomId,
		extended.rid
	]
		.filter(
			(value) => value !== null && value !== undefined && value !== ''
		)
		.map((value) => String(value));

	return Array.from(new Set(values));
};

export const draftMatchesSession = (
	draft: IUserDraftItem,
	raw: ListItemInterface,
	extended: ExtendedSessionInterface
) => {
	const identities = new Set(getSessionIdentityValues(raw, extended));
	const candidateValues = new Set<string>();

	const addCandidate = (value: unknown) => {
		if (value === null || value === undefined || value === '') {
			return;
		}
		const normalizedValue = String(value).trim();
		if (!normalizedValue) {
			return;
		}
		candidateValues.add(normalizedValue);
		if (normalizedValue.startsWith('scope:')) {
			const scopeValue = normalizedValue
				.split('|')
				.find((part) => part.startsWith('scope:'))
				?.replace(/^scope:/, '');
			if (scopeValue) {
				candidateValues.add(scopeValue);
			}
		}
	};

	[
		draft.sourceSessionId,
		(draft as { sessionId?: string | number | null }).sessionId,
		draft.roomRef,
		draft.scopeKey
	].forEach(addCandidate);

	if (draft.actionPath) {
		try {
			const parsedPath = new URL(
				draft.actionPath,
				window.location.origin
			);
			parsedPath.pathname.split('/').forEach(addCandidate);
			parsedPath.searchParams.forEach((value) => addCandidate(value));
		} catch {
			draft.actionPath.split(/[/?&=#]/).forEach(addCandidate);
		}
	}

	return Array.from(identities).some((identity) =>
		candidateValues.has(identity)
	);
};

export function sessionMatchesToolbar(
	raw: ListItemInterface,
	extended: ExtendedSessionInterface,
	query: string,
	chip: SessionToolbarChipFilter | null,
	selectedPersonIds: string[],
	drafts: IUserDraftItem[],
	currentUserId?: string,
	/**
	 * The row the route currently has open. The display filter already keeps
	 * the open conversation visible (§5.2, `applySessionsFilter`); the chip
	 * axis runs after it and used to drop the very session the consultant is
	 * chatting in as soon as the chip flipped — an accepted live chat vanished
	 * behind the "Chats" chip and could not be reopened (#1404).
	 */
	isRouteActive: boolean = false,
	/** Role labels of the shown language; staff-only internal names. */
	textOptions?: SessionSearchTextOptions
): boolean {
	const chatItem = getToolbarChatItem(raw);

	/*
	 * Enquiry-feed axis (Anfragen tab):
	 *   - chip === 'liveChat' → only anonymous asker sessions
	 *   - chip === 'nearby'   → only NON-anonymous, non-group sessions
	 *   - anything else / null → don't filter on this axis
	 * Runs client-side against the /enquiries/registered feed because this
	 * install doesn't populate registration_type=ANONYMOUS in the DB.
	 */
	const effectiveChip = isRouteActive ? null : chip;

	const isAnonymous = isAnonymousAskerSession(raw, extended);
	if (effectiveChip === 'liveChat' && !isAnonymous) {
		return false;
	}
	if (effectiveChip === 'nearby' && (isAnonymous || extended.isGroup)) {
		return false;
	}

	if (effectiveChip === 'unread') {
		// Derived from the Matrix client (#1147) — the DTO's `messagesRead`
		// is hard-coded to true by the backend and must not be consulted.
		if (!isChatItemUnread(chatItem)) {
			return false;
		}
	} else if (effectiveChip === 'drafts') {
		if (
			!drafts.some((draft) => draftMatchesSession(draft, raw, extended))
		) {
			return false;
		}
	} else if (effectiveChip === 'internalGroup') {
		if (!isInternalGroupChatSession(extended)) {
			return false;
		}
	} else if (effectiveChip === 'groups') {
		if (!isConversationCircleSession(extended)) {
			return false;
		}
	} else if (effectiveChip === 'supervision') {
		// Same rule as the display filter (#1703): a colleague's group chat
		// is never supervision, whatever the marker fallback says. The chip
		// is only listed for consultants who can supervise.
		if (
			classifySession(raw, extended, currentUserId, true) !==
			'supervision'
		) {
			return false;
		}
	}

	// Person rows are `<role>:<userId>:<agencyId>` (FE#1725); several
	// selected people combine with OR.
	if (!sessionMatchesPeople(raw, selectedPersonIds)) {
		return false;
	}

	return sessionMatchesSearchText(raw, extended, query, textOptions);
}
