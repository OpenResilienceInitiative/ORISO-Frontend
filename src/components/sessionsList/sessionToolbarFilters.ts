import { getModality, Modality } from '../session/getModality';
import type {
	ListItemInterface,
	TopicSessionInterface
} from '../../globalState/interfaces/SessionsDataInterface';
import type { ExtendedSessionInterface } from '../../globalState/helpers/stateHelpers';
import type { IUserDraftItem } from '../../api/apiUserDrafts';
import { isChatItemUnread } from '../../utils/sessionUnread';
import {
	sessionKeyFromPersonId,
	sessionSearchKeyOf
} from './sessionSearchPeople';

export type SessionToolbarChipFilter =
	| 'unread'
	| 'drafts'
	| 'nearby'
	| 'liveChat'
	| 'internalGroup'
	| 'groups'
	| 'supervision';

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
 * Search haystack for the session toolbar. Metadata-only by design —
 * Matrix/E2EE message bodies must never affect list search results.
 */
export function buildSessionSearchHaystack(
	raw: ListItemInterface,
	extended: ExtendedSessionInterface
): string {
	const parts: string[] = [];
	const item = extended.item;

	if (item?.topic) {
		parts.push(
			typeof item.topic === 'string'
				? item.topic
				: (item.topic as TopicSessionInterface).name || ''
		);
	}
	if (raw.user?.username) {
		parts.push(raw.user.username);
	}
	if (raw.consultant?.displayName) {
		parts.push(raw.consultant.displayName);
	}
	if (raw.consultant?.username) {
		parts.push(raw.consultant.username);
	}
	if (raw.agency?.name) {
		parts.push(raw.agency.name);
	}
	return parts.filter(Boolean).join(' ');
}

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
	currentUserId?: string
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
	const isAnonymous = isAnonymousAskerSession(raw, extended);
	if (chip === 'liveChat' && !isAnonymous) {
		return false;
	}
	if (chip === 'nearby' && (isAnonymous || extended.isGroup)) {
		return false;
	}

	if (chip === 'unread') {
		// Derived from the Matrix client (#1147) — the DTO's `messagesRead`
		// is hard-coded to true by the backend and must not be consulted.
		if (!isChatItemUnread(chatItem)) {
			return false;
		}
	} else if (chip === 'drafts') {
		if (
			!drafts.some((draft) => draftMatchesSession(draft, raw, extended))
		) {
			return false;
		}
	} else if (chip === 'internalGroup') {
		if (!isInternalGroupChatSession(extended)) {
			return false;
		}
	} else if (chip === 'groups') {
		if (!isConversationCircleSession(extended)) {
			return false;
		}
	} else if (chip === 'supervision') {
		if (!raw.consultant?.id) {
			return false;
		}
		if (String(raw.consultant.id) === String(currentUserId || '')) {
			// Assigned consultant chats are excluded; only supervised chats remain.
			return false;
		}
	}

	// Person rows are `<sessionId>:<role>` since #1195 (clients and counsellors
	// are separate rows), while this axis still filters whole sessions — so the
	// role suffix is stripped before comparing.
	const toolbarPersonId = sessionSearchKeyOf(raw, extended);
	if (selectedPersonIds.length > 0) {
		const selectedSessionKeys = selectedPersonIds.map(
			sessionKeyFromPersonId
		);
		if (
			!toolbarPersonId ||
			!selectedSessionKeys.includes(toolbarPersonId)
		) {
			return false;
		}
	}

	const q = query.trim().toLowerCase();
	if (!q) {
		return true;
	}
	return buildSessionSearchHaystack(raw, extended).toLowerCase().includes(q);
}
