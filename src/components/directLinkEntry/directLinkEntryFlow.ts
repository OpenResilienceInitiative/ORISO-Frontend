import {
	apiCancelOwnCallKnock,
	apiStartDirectLinkConversation,
	CallKnockStatus,
	DirectLinkConversation
} from '../../api/apiDirectLinks';
import type { DirectLinkMedium } from '../conversationCreate/directLink/directLink';
import { apiGetConsultingType } from '../../api/apiGetConsultingType';
import type { InviteLinkContext } from '../../api/apiGetInviteLinkContext';
import { redirectToApp } from '../registration/autoLogin';
import type { CallLifecycleMessage } from '../../utils/callLifecycleMessage';
import type { JoinMedia } from '../call/prejoin/callPrejoin';
import type { CallDeviceSelection } from '../waitingRoom/callEntry/callEntryTypes';

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

/** How long the arrival page waits for the form of counselling before it lets the server decide. */
export const CALLS_ALLOWED_READ_MS = 5_000;

/**
 * Whether the link's form of counselling has calls (#2012), for a person who
 * has no session yet: the server allows a call only where the consulting type
 * says `isVideoCallAllowed === true`, so an audio or video link of any other
 * one would end in a refusal at "Beitreten". A link without a form of
 * counselling, a read that fails or a read that does not answer in time counts
 * as allowed — the server decides then.
 */
export const directLinkCallsAllowed = async (
	context: InviteLinkContext,
	timeoutMs = CALLS_ALLOWED_READ_MS
): Promise<boolean> => {
	if (context.consultingTypeId == null) return true;
	let timer: ReturnType<typeof setTimeout> | undefined;
	const gaveUp = new Promise<null>((resolve) => {
		timer = setTimeout(() => resolve(null), timeoutMs);
	});
	try {
		const consultingType = await Promise.race([
			apiGetConsultingType({
				consultingTypeId: context.consultingTypeId
			}).catch(() => null),
			gaveUp
		]);
		return consultingType
			? consultingType.isVideoCallAllowed === true
			: true;
	} finally {
		clearTimeout(timer);
	}
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
	/**
	 * Which running call that is (#2016), so a person let in after a reload
	 * joins it at once instead of tapping the call message again.
	 */
	joinCall?: KnockJoinCall;
	/**
	 * FE#2542: the person waited on the link page and was let in there. The
	 * app then opens the call at once, without the knock dialog a second time.
	 */
	admittedOnEntry?: boolean;
	/**
	 * FE#2542: microphone and camera as the link page left them. The app is a
	 * new document after the link page, so the choice travels with the knock.
	 */
	entryMedia?: EntryMedia | null;
}

/** What `rememberJoinMedia` takes; device labels and ids, nothing personal. */
export interface EntryMedia {
	media: JoinMedia | null;
	cameraSwitch?: boolean;
	selection?: CallDeviceSelection;
}

/** How the wait on the link page ended (FE#2542). */
/**
 * `ended`: the wait stopped without an answer: the session is no longer
 * valid (401) or nobody answered within the maximum wait.
 */
export type AdmissionOutcome = 'admitted' | 'declined' | 'cancelled' | 'ended';

/** The person waited on the link page and did not get in: they stay there. */
export class DirectLinkNotAdmittedError extends Error {
	constructor(readonly outcome: Exclude<AdmissionOutcome, 'admitted'>) {
		super(`direct link knock ${outcome}`);
		this.name = 'DirectLinkNotAdmittedError';
	}
}

/**
 * Only what the reload join needs; never who is in the call (names, Matrix
 * ids). This lands in `sessionStorage`.
 */
export type KnockJoinCall = Pick<
	CallLifecycleMessage,
	'callId' | 'state' | 'roomRef' | 'callRoomId' | 'callType' | 'isGroup'
>;

export const knockJoinCallOf = (call: CallLifecycleMessage): KnockJoinCall => ({
	callId: call.callId,
	state: call.state,
	roomRef: call.roomRef,
	callRoomId: call.callRoomId,
	callType: call.callType,
	...(call.isGroup === undefined ? {} : { isGroup: call.isGroup })
});

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

/**
 * The conversation a call room belongs to, when it came through an audio or
 * video direct link on this device. The ringing card knows only the room.
 */
export const directLinkSessionIdOfRoom = (
	roomIds: Array<string | null | undefined>
): number | null => {
	const rooms = roomIds.filter(Boolean);
	const found = Object.entries(readDirectLinkSessions()).find(
		([, link]) =>
			link?.medium !== 'CHAT' &&
			Boolean(link?.matrixRoomId) &&
			rooms.includes(link.matrixRoomId)
	);
	const id = found ? Number(found[0]) : NaN;
	return Number.isFinite(id) ? id : null;
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

/*
 * "Let in once" (Frank, 2026-10-28): after the first admission the person
 * joins later calls in that 1:1 conversation without knocking. The server
 * is the source of truth (`GET /users/call-knocks/mine?sessionId=`, and
 * `callAdmitted` when the link is opened again, #1479 91f4c623), so it works
 * on every device. This per-device list only saves that lookup.
 */
export const DIRECT_LINK_ADMITTED_KEY = 'oriso.directLinkAdmitted';

const readAdmitted = (): number[] => {
	try {
		const parsed = JSON.parse(
			localStorage.getItem(DIRECT_LINK_ADMITTED_KEY) ?? '[]'
		);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
};

export const rememberAdmittedConversation = (sessionId: number) => {
	try {
		const all = readAdmitted().filter((id) => id !== sessionId);
		all.push(sessionId);
		localStorage.setItem(
			DIRECT_LINK_ADMITTED_KEY,
			JSON.stringify(all.slice(-50))
		);
	} catch {
		/* Web Storage may be off; the person then knocks once more. */
	}
};

export const wasAdmittedTo = (sessionId: number | null | undefined) =>
	sessionId != null && readAdmitted().includes(sessionId);

/**
 * P0 Direkteinladung: a person who knocked on this call and is not let in yet
 * is waiting in the knock dialog. The call that the counsellor starts must not
 * also ring them: "Annehmen" would open the call without admission and end in
 * "Call access denied" (403).
 */
export const isKnockingOnCall = (
	pending: PendingKnock | null,
	callRoomIds: Array<string | null | undefined>
): boolean =>
	Boolean(
		pending &&
			pending.status !== 'ADMITTED' &&
			pending.matrixRoomId &&
			callRoomIds.includes(pending.matrixRoomId)
	);

/** The call notice in the feed knows only the room: it must not skip the knock. */
export const isDirectLinkCallRoom = (roomId: string | null | undefined) =>
	Boolean(roomId) &&
	Object.values(readDirectLinkSessions()).some(
		(link) => link?.matrixRoomId === roomId && link.medium !== 'CHAT'
	);

/** How long entering the chat waits for withdrawing a call knock. */
export const CANCEL_KNOCK_WAIT_MS = 3000;

export interface OpenDirectLinkDeps {
	start?: typeof apiStartDirectLinkConversation;
	redirect?: (sessionId: number) => void;
	cancelKnock?: typeof apiCancelOwnCallKnock;
	/**
	 * #2252: the person chose "Zum Chat" before the call opened. The knock
	 * gates only the call; the chat works at once, so no call knock goes along.
	 */
	chatFirst?: boolean;
	/**
	 * #2252: a person in a shared conversation agrees for themselves. Asked
	 * when the server says this person has not agreed yet; resolves once the
	 * agreement is recorded. Until then the person does not enter.
	 */
	consent?: (conversation: DirectLinkConversation) => Promise<void>;
	/**
	 * FE#2542: the link page waits for the counsellor itself. With it, a
	 * pending knock is waited for here and the app opens only after "let in";
	 * turned down or withdrawn, nothing opens and the call rejects with
	 * `DirectLinkNotAdmittedError`. Without it the app opens at once and its
	 * knock dialog waits (the path of a call started inside the app).
	 */
	waitForAdmission?: (knock: PendingKnock) => Promise<AdmissionOutcome>;
	/** Read when the person is let in: the switches as they are then. */
	entryMedia?: () => EntryMedia | null;
}

/**
 * The signed-in person opens (or reopens) their conversation through the
 * link and enters the app on it. For a call the knock goes along, unless
 * the person chose the chat first.
 */
export const openDirectLinkConversation = async (
	token: string,
	{
		start = apiStartDirectLinkConversation,
		redirect = (sessionId) => redirectToApp(undefined, { sessionId }),
		cancelKnock = apiCancelOwnCallKnock,
		chatFirst = false,
		consent,
		waitForAdmission,
		entryMedia
	}: OpenDirectLinkDeps = {}
): Promise<DirectLinkConversation> => {
	const conversation = await start(token);
	if (conversation.consentRequired && consent) await consent(conversation);
	rememberDirectLinkSession(conversation.sessionId, {
		token,
		medium: conversation.medium,
		matrixRoomId: conversation.matrixRoomId ?? null
	});
	if (conversation.callAdmitted) {
		rememberAdmittedConversation(conversation.sessionId);
	}
	const knock = pendingKnockFrom(token, conversation);
	if (knock && !chatFirst) rememberPendingKnock(knock);
	else forgetPendingKnock();
	/* The server knocks as soon as the call window is open, also when the
	   person came for the chat: withdraw that knock so the counsellor is not
	   asked to let in someone who is not waiting. An admission stays (the
	   server cancels only a pending knock); the call in the chat knocks anew. */
	if (knock && chatFirst && knock.status === 'PENDING') {
		/* Best effort, and bounded: a hanging request must not hold the
		   person outside the chat. The server ends an abandoned knock itself. */
		let timer: ReturnType<typeof setTimeout> | undefined;
		await Promise.race([
			cancelKnock(knock.knockId).catch(() => undefined),
			new Promise<void>((resolve) => {
				timer = setTimeout(resolve, CANCEL_KNOCK_WAIT_MS);
			})
		]);
		clearTimeout(timer);
	}
	if (knock && !chatFirst && waitForAdmission) {
		const outcome =
			knock.status === 'PENDING'
				? await waitForAdmission(knock)
				: knock.status === 'ADMITTED'
					? 'admitted'
					: null;
		if (outcome && outcome !== 'admitted') {
			forgetPendingKnock();
			throw new DirectLinkNotAdmittedError(outcome);
		}
		if (outcome === 'admitted') {
			rememberPendingKnock({
				...knock,
				status: 'ADMITTED',
				admittedOnEntry: true,
				entryMedia: entryMedia?.() ?? null
			});
		}
	}
	redirect(conversation.sessionId);
	return conversation;
};

export {
	directLinkReturnPath,
	loginPathForDirectLink
} from '../../utils/directLinkReturn';
