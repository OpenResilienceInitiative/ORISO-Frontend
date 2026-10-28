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

export type CallJoinResult = 'joined' | 'busy' | 'ended' | 'unavailable';

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

export interface JoinOrKnockDeps {
	start?: typeof apiStartDirectLinkConversation;
	mine?: typeof apiGetOwnCallKnockForSession;
	/** Only askers knock; a counsellor's join is never gated. */
	asker?: boolean;
}

const waitOn = (
	sessionId: number,
	knock: Parameters<typeof rememberPendingKnock>[0],
	join: () => Promise<CallJoinResult>
): CallJoinResult => {
	admittedJoins.set(sessionId, () => void join().catch(() => undefined));
	rememberPendingKnock({ ...knock, joinExisting: true });
	announcePendingKnock();
	// The card shows no error: the knock dialog takes over.
	return 'joined';
};

/**
 * What the call card's "Beitreten" does for an asker:
 * 1. Let in before (cache, else the server): join.
 * 2. Still waiting (e.g. knocked on another device): the wait dialog.
 * 3. A direct-link conversation without admission: knock through the link.
 * 4. Anything else (never knocked, no link known): the plain join, and the
 *    server's call policy decides.
 */
export const joinOrKnock = async (
	sessionId: number | null | undefined,
	join: () => Promise<CallJoinResult>,
	{
		start = apiStartDirectLinkConversation,
		mine = apiGetOwnCallKnockForSession,
		asker = true
	}: JoinOrKnockDeps = {}
): Promise<CallJoinResult> => {
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
			join
		);
	}
	if (!link) return join();

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
	return waitOn(sessionId, knock, join);
};
