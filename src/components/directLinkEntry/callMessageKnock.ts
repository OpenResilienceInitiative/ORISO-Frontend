import {
	apiGetOwnCallKnockForSession,
	apiStartDirectLinkConversation,
	CallKnock
} from '../../api/apiDirectLinks';
import {
	announcePendingKnock,
	directLinkSessionOf,
	rememberAdmittedConversation,
	wasAdmittedTo,
	pendingKnockFrom,
	rememberPendingKnock
} from './directLinkEntryFlow';
import { knockJoinCallOf } from './directLinkEntryFlow';
import type { PendingKnock } from './directLinkEntryFlow';
import type { CallLifecycleMessage } from '../../utils/callLifecycleMessage';

/**
 * `cancelled`: the person dismissed the device check before the join went
 * out (#2016). Not a failure; nothing was started.
 */
export type CallJoinResult =
	| 'joined'
	| 'busy'
	| 'ended'
	| 'unavailable'
	| 'cancelled';

/*
 * FE#1893: in a conversation that came through an audio or video direct
 * link, the running call's card knocks first, exactly like the link does,
 * and the person joins the call once the counsellor lets them in. Only the
 * first time: once let in, later calls are joined directly.
 */

/** The join waiting for the counsellor's answer, per conversation. */
const admittedJoins = new Map<number, () => void>();

export {
	DIRECT_LINK_ADMITTED_KEY,
	rememberAdmittedConversation,
	wasAdmittedTo
} from './directLinkEntryFlow';

/** The knock gate runs this once the person was let in. */
export const takeAdmittedJoin = (sessionId: number) => {
	const join = admittedJoins.get(sessionId);
	admittedJoins.delete(sessionId);
	return join;
};

/**
 * Who can be sent to the lobby at all. The server's call policy
 * (ORISO-UserService `MatrixRtcCallPolicyService`, KNOCK_NOT_ADMITTED) gates
 * only an advice seeker whose latest direct-link knock in the conversation
 * is not ADMITTED; direct links are 1:1. A counsellor and a group member
 * join directly.
 */
export const callCardMayKnock = ({
	isAsker,
	isGroup
}: {
	isAsker: boolean;
	isGroup: boolean;
}): boolean => isAsker && !isGroup;

/**
 * The pre-join check that is open over the call message (#2016). It is the
 * one window: it waits for the counsellor itself, so no second dialog.
 */
export interface CallJoinHooks {
	/**
	 * Right before the join: the check closes and lets go of the camera.
	 * `false`: the check is already gone (dismissed while this was looked
	 * up), so no call is started at all.
	 */
	beforeJoin?: () => boolean | void;
	/** A knock is out: the check waits in place and joins once let in. */
	onKnock?: (
		knock: PendingKnock,
		joinOnceAdmitted: () => Promise<CallJoinResult>
	) => void;
}

export interface JoinOrKnockDeps extends CallJoinHooks {
	start?: typeof apiStartDirectLinkConversation;
	mine?: typeof apiGetOwnCallKnockForSession;
	/** Only askers knock; a counsellor's join is never gated. */
	asker?: boolean;
	/** The running call the card shows, kept with the knock for a reload. */
	call?: CallLifecycleMessage;
}

/* Knocks the open check holds; the knock gate leaves them alone. */
const claimedKnocks = new Set<number>();
export const claimKnock = (knockId: number) => claimedKnocks.add(knockId);
export const releaseKnock = (knockId: number) => {
	claimedKnocks.delete(knockId);
};
export const isKnockClaimed = (knockId: number) => claimedKnocks.has(knockId);

/**
 * Turned down before, and this device has no link to knock again with: the
 * server would refuse the call, so the lobby shows the refusal instead of
 * opening a call that cannot connect. Nothing waits for an admission. With
 * the device check open (#2016) the refusal shows in that same window.
 */
const showRefusal = (
	sessionId: number,
	own: CallKnock,
	join: () => Promise<CallJoinResult>,
	{ onKnock }: JoinOrKnockDeps
): CallJoinResult => {
	const refused: PendingKnock = {
		token: '',
		knockId: own.id,
		sessionId,
		medium: own.medium,
		status: 'DECLINED',
		joinExisting: true
	};
	rememberPendingKnock(refused);
	if (onKnock) {
		claimKnock(refused.knockId);
		onKnock(refused, join);
	} else {
		announcePendingKnock();
	}
	return 'joined';
};

const waitOn = (
	sessionId: number,
	knock: PendingKnock,
	join: () => Promise<CallJoinResult>,
	{ onKnock, call }: JoinOrKnockDeps
): CallJoinResult => {
	const pending: PendingKnock = {
		...knock,
		joinExisting: true,
		...(call ? { joinCall: knockJoinCallOf(call) } : {})
	};
	rememberPendingKnock(pending);
	if (onKnock) {
		claimKnock(pending.knockId);
		onKnock(pending, join);
	} else {
		admittedJoins.set(sessionId, () => void join().catch(() => undefined));
		announcePendingKnock();
	}
	// The card shows no error: the waiting window takes over.
	return 'joined';
};

/**
 * What a person let in does next.
 * - `storedJoin`: the card's own join is still in memory.
 * - `joinRunningCall`: after a reload, the call recorded with the knock.
 * - `startCall`: a knock from the direct link itself starts the call.
 * - `none`: from the card, with nothing on record; the card's next tap joins.
 */
export const admissionAction = (
	knock: PendingKnock,
	storedJoin: (() => void) | undefined
): 'storedJoin' | 'joinRunningCall' | 'startCall' | 'none' => {
	if (!knock.joinExisting) return 'startCall';
	if (storedJoin) return 'storedJoin';
	return knock.joinCall ? 'joinRunningCall' : 'none';
};

/**
 * What the call card's "Beitreten" does for an asker:
 * 1. Let in before (cache, else the server): join.
 * 2. Still waiting (e.g. knocked on another device): the wait dialog.
 * 3. A direct-link conversation without admission: knock through the link.
 * 4. Turned down or withdrawn and no link on this device: no call, because
 *    the server refuses it — the refusal in the lobby, or the card's
 *    "cannot join" for a withdrawn knock (a new knock needs the link).
 * 5. Anything else (never knocked, lookup failed): the plain join, and the
 *    server's call policy decides.
 */
export const joinOrKnock = async (
	sessionId: number | null | undefined,
	joinCall: () => Promise<CallJoinResult>,
	deps: JoinOrKnockDeps = {}
): Promise<CallJoinResult> => {
	const {
		start = apiStartDirectLinkConversation,
		mine = apiGetOwnCallKnockForSession,
		asker = true,
		beforeJoin
	} = deps;
	const join = (): Promise<CallJoinResult> => {
		/* Dismissed meanwhile: "Niemand sieht oder hört Sie, bevor Sie
		   beitreten" — so nobody is put into the call. */
		if (beforeJoin?.() === false) return Promise.resolve('cancelled');
		return joinCall();
	};
	if (sessionId == null || !asker) return join();
	if (wasAdmittedTo(sessionId)) return join();
	const link = directLinkSessionOf(sessionId);

	let own: CallKnock | null | undefined;
	try {
		own = await mine(sessionId);
	} catch {
		own = undefined; // lookup failed: the link below still answers
	}
	if (own?.status === 'ADMITTED') {
		rememberAdmittedConversation(sessionId);
		return join();
	}
	if (own === null && !link) return join();
	if (own?.status === 'PENDING') {
		return waitOn(
			sessionId,
			{
				token: link?.token ?? '',
				knockId: own.id,
				sessionId,
				medium: own.medium,
				status: 'PENDING'
			},
			joinCall,
			deps
		);
	}
	if (!link) {
		/* Turned down or withdrawn, and no link here to knock again: the
		   server refuses the call (KNOCK_NOT_ADMITTED), so none is opened. */
		if (own?.status === 'DECLINED')
			return showRefusal(sessionId, own, joinCall, deps);
		if (own?.status === 'CANCELLED') return 'unavailable';
		return join();
	}

	let conversation;
	try {
		conversation = await start(link.token);
	} catch {
		// Link switched off or gone: the server's call policy decides.
		return join();
	}
	const knock = pendingKnockFrom(link.token, conversation);
	if (!knock || conversation.callAdmitted || knock.status === 'ADMITTED') {
		rememberAdmittedConversation(sessionId);
		return join();
	}
	return waitOn(sessionId, knock, joinCall, deps);
};
