import {
	apiStartDirectLinkConversation,
	CallKnockStatus,
	DirectLinkConversation
} from '../../api/apiDirectLinks';
import type { DirectLinkMedium } from '../conversationCreate/directLink/directLink';
import type { InviteLinkContext } from '../../api/apiGetInviteLinkContext';
import { redirectToApp } from '../registration/autoLogin';

/**
 * Counsellor direct links on the person's side (#1795, ORISO-UserService#1479):
 *
 *   link → account (registration or login) → own 1:1 conversation
 *        → chat: straight into it
 *        → audio/video: the knock waits over that conversation until the
 *          counsellor lets the person in, then the call starts.
 *
 * The knock is handed from the invite page to the app through
 * `sessionStorage`, because the app is entered with a document load and the
 * knock dialog needs the signed-in app (Matrix client, call manager).
 */

export const DIRECT_LINK_MEDIA_TYPES: DirectLinkMedium[] = [
	'CHAT',
	'AUDIO',
	'VIDEO'
];

/** A direct link's context carries `admission`; no other link kind does. */
export const directLinkMediumOf = (
	context: InviteLinkContext | null | undefined
): DirectLinkMedium | null => {
	if (!context?.admission) return null;
	const medium = context.chatType as DirectLinkMedium;
	return DIRECT_LINK_MEDIA_TYPES.includes(medium) ? medium : null;
};

export const PENDING_KNOCK_KEY = 'oriso.directLinkKnock';

export interface PendingKnock {
	token: string;
	knockId: number;
	sessionId: number;
	matrixRoomId?: string | null;
	medium: DirectLinkMedium;
	status?: CallKnockStatus | null;
	/**
	 * Knocked from a running call's message in the conversation (FE#1893):
	 * once let in, the person joins that call instead of starting one.
	 */
	joinExisting?: boolean;
}

const isPendingKnock = (value: unknown): value is PendingKnock => {
	const knock = value as PendingKnock;
	return (
		typeof knock?.token === 'string' &&
		typeof knock.knockId === 'number' &&
		typeof knock.sessionId === 'number' &&
		DIRECT_LINK_MEDIA_TYPES.includes(knock.medium)
	);
};

/* Best effort: Web Storage throws when disabled or full. Without it the
   person still lands in the conversation; only the dialog is missing. */
export const rememberPendingKnock = (knock: PendingKnock) => {
	try {
		sessionStorage.setItem(PENDING_KNOCK_KEY, JSON.stringify(knock));
	} catch {
		/* see above */
	}
};

export const readPendingKnock = (): PendingKnock | null => {
	try {
		const raw = sessionStorage.getItem(PENDING_KNOCK_KEY);
		const parsed = raw ? JSON.parse(raw) : null;
		return isPendingKnock(parsed) ? parsed : null;
	} catch {
		return null;
	}
};

export const forgetPendingKnock = () => {
	try {
		sessionStorage.removeItem(PENDING_KNOCK_KEY);
	} catch {
		/* see above */
	}
};

/** Tells the mounted knock gate that a knock was just stored. */
export const PENDING_KNOCK_EVENT = 'oriso:directLinkKnock';

export const announcePendingKnock = () => {
	window.dispatchEvent(new Event(PENDING_KNOCK_EVENT));
};

/*
 * Which of the person's conversations came through an audio or video direct
 * link, and with which link. A later call in that conversation knocks through
 * the same link (FE#1893); the server has no knock by conversation id. Kept
 * on this device only (`localStorage`), so on another device the call card
 * joins as before and the server's call policy decides.
 */
export const DIRECT_LINK_SESSIONS_KEY = 'oriso.directLinkSessions';
const MAX_DIRECT_LINK_SESSIONS = 20;

export interface DirectLinkSession {
	token: string;
	medium: DirectLinkMedium;
	matrixRoomId?: string | null;
}

const readDirectLinkSessions = (): Record<string, DirectLinkSession> => {
	try {
		const parsed = JSON.parse(
			localStorage.getItem(DIRECT_LINK_SESSIONS_KEY) ?? '{}'
		);
		return parsed && typeof parsed === 'object' ? parsed : {};
	} catch {
		return {};
	}
};

export const rememberDirectLinkSession = (
	sessionId: number,
	link: DirectLinkSession
) => {
	if (link.medium === 'CHAT') return;
	try {
		const entries = Object.entries(readDirectLinkSessions()).filter(
			([id]) => id !== String(sessionId)
		);
		entries.push([String(sessionId), link]);
		localStorage.setItem(
			DIRECT_LINK_SESSIONS_KEY,
			JSON.stringify(
				Object.fromEntries(entries.slice(-MAX_DIRECT_LINK_SESSIONS))
			)
		);
	} catch {
		/* see above */
	}
};

export const directLinkSessionOf = (
	sessionId: number | null | undefined
): DirectLinkSession | null => {
	if (sessionId == null) return null;
	const link = readDirectLinkSessions()[String(sessionId)];
	return typeof link?.token === 'string' &&
		DIRECT_LINK_MEDIA_TYPES.includes(link.medium) &&
		link.medium !== 'CHAT'
		? link
		: null;
};

export const pendingKnockFrom = (
	token: string,
	conversation: DirectLinkConversation
): PendingKnock | null =>
	conversation.admission === 'KNOCK' &&
	typeof conversation.knockId === 'number'
		? {
				token,
				knockId: conversation.knockId,
				sessionId: conversation.sessionId,
				matrixRoomId: conversation.matrixRoomId ?? null,
				medium: conversation.medium,
				status: conversation.knockStatus ?? null
			}
		: null;

/** The call notice in the feed knows only the room: it must not skip the knock. */
export const isDirectLinkCallRoom = (roomId: string | null | undefined) =>
	Boolean(roomId) &&
	Object.values(readDirectLinkSessions()).some(
		(link) => link?.matrixRoomId === roomId && link.medium !== 'CHAT'
	);

export interface OpenDirectLinkDeps {
	start?: typeof apiStartDirectLinkConversation;
	redirect?: (sessionId: number) => void;
}

/**
 * The signed-in person opens (or reopens) their conversation through the
 * link and enters the app on it. For a call the knock goes along.
 */
export const openDirectLinkConversation = async (
	token: string,
	{
		start = apiStartDirectLinkConversation,
		redirect = (sessionId) => redirectToApp(undefined, { sessionId })
	}: OpenDirectLinkDeps = {}
): Promise<DirectLinkConversation> => {
	const conversation = await start(token);
	rememberDirectLinkSession(conversation.sessionId, {
		token,
		medium: conversation.medium,
		matrixRoomId: conversation.matrixRoomId ?? null
	});
	const knock = pendingKnockFrom(token, conversation);
	if (knock) rememberPendingKnock(knock);
	else forgetPendingKnock();
	redirect(conversation.sessionId);
	return conversation;
};

export {
	directLinkReturnPath,
	loginPathForDirectLink
} from '../../utils/directLinkReturn';
