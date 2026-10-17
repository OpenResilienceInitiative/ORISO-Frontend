import { getModality, Modality } from '../session/getModality';
import type { ListItemInterface } from '../../globalState/interfaces/SessionsDataInterface';
import type { ExtendedSessionInterface } from '../../globalState/helpers/stateHelpers';
import type { IUserDraftItem } from '../../api/apiUserDrafts';
import { isChatItemUnread } from '../../utils/sessionUnread';
import {
	getSupervisionListState,
	hasSupervisionMarker
} from '../sessionsListItem/supervisionListState';
import {
	SessionSearchRoleLabels,
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
	/** Role labels of the shown language (FE#1725 US6). */
	roleLabels?: SessionSearchRoleLabels
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
		if (hasSupervisionMarker(extended)) {
			// ADR-008 list marker: the backend says whether I supervise this row.
			if (
				getSupervisionListState(extended, currentUserId) !==
				'supervisedByMe'
			) {
				return false;
			}
		} else {
			// Older backend without the marker: fall back to the heuristic
			// "any row owned by another consultant". Remove once every
			// environment sends `session.supervision`.
			if (!raw.consultant?.id) {
				return false;
			}
			if (String(raw.consultant.id) === String(currentUserId || '')) {
				// Assigned consultant chats are excluded; only supervised chats remain.
				return false;
			}
		}
	}

	// Person rows are `<role>:<userId>:<agencyId>` (FE#1725); several
	// selected people combine with OR.
	if (!sessionMatchesPeople(raw, selectedPersonIds)) {
		return false;
	}

	return sessionMatchesSearchText(raw, extended, query, roleLabels);
}
