import { apiStartDirectLinkConversation } from '../../api/apiDirectLinks';
import {
	announcePendingKnock,
	directLinkSessionOf,
	pendingKnockFrom,
	rememberPendingKnock
} from './directLinkEntryFlow';

export type CallJoinResult = 'joined' | 'busy' | 'ended' | 'unavailable';

/*
 * FE#1893: in a conversation that came through an audio or video direct
 * link, the running call's card knocks first, exactly like the link does,
 * and the person joins the call once the counsellor lets them in.
 */

/** The join waiting for the counsellor's answer, per conversation. */
const admittedJoins = new Map<number, () => void>();

/** Let in while the page was reloaded: the next tap joins without a knock. */
const ADMITTED_KEY = 'oriso.directLinkAdmitted';
const ADMITTED_VALID_MS = 10 * 60_000;

const readAdmitted = (): Record<string, number> => {
	try {
		return JSON.parse(sessionStorage.getItem(ADMITTED_KEY) ?? '{}') ?? {};
	} catch {
		return {};
	}
};

export const rememberAdmittedCall = (sessionId: number, now = Date.now()) => {
	try {
		sessionStorage.setItem(
			ADMITTED_KEY,
			JSON.stringify({ ...readAdmitted(), [sessionId]: now })
		);
	} catch {
		/* Web Storage may be off; the person then knocks once more. */
	}
};

const consumeAdmittedCall = (sessionId: number, now = Date.now()) => {
	const all = readAdmitted();
	const at = all[sessionId];
	if (at === undefined) return false;
	delete all[sessionId];
	try {
		sessionStorage.setItem(ADMITTED_KEY, JSON.stringify(all));
	} catch {
		/* see above */
	}
	return now - at < ADMITTED_VALID_MS;
};

/** The knock gate runs this once the person was let in. */
export const takeAdmittedJoin = (sessionId: number) => {
	const join = admittedJoins.get(sessionId);
	admittedJoins.delete(sessionId);
	return join;
};

export interface JoinOrKnockDeps {
	start?: typeof apiStartDirectLinkConversation;
}

/**
 * What the call card's "Beitreten" does. Without a direct link on record
 * for the conversation it is the plain join. With one, it knocks through the
 * link and reports `joined`, so the card shows no error while the knock dialog
 * takes over; the join itself runs after admission.
 */
export const joinOrKnock = async (
	sessionId: number | null | undefined,
	join: () => Promise<CallJoinResult>,
	{ start = apiStartDirectLinkConversation }: JoinOrKnockDeps = {}
): Promise<CallJoinResult> => {
	const link = directLinkSessionOf(sessionId);
	if (!link || sessionId == null) return join();
	if (consumeAdmittedCall(sessionId)) return join();

	let conversation;
	try {
		conversation = await start(link.token);
	} catch {
		// Link switched off or gone: the server's call policy decides.
		return join();
	}
	const knock = pendingKnockFrom(link.token, conversation);
	if (!knock || knock.status === 'ADMITTED') return join();

	admittedJoins.set(sessionId, () => void join().catch(() => undefined));
	rememberPendingKnock({ ...knock, joinExisting: true });
	announcePendingKnock();
	return 'joined';
};
