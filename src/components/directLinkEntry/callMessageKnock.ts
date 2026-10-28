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
 * and the person joins the call once the counsellor lets them in. Only the
 * first time: once let in, later calls are joined directly.
 */

/** The join waiting for the counsellor's answer, per conversation. */
const admittedJoins = new Map<number, () => void>();

/*
 * "Let in once" (Frank, 2026-10-28): after the first admission the person
 * joins later calls in that 1:1 conversation without knocking. The server's
 * call policy follows the latest knock, and UserService#1479 exposes no
 * admission per conversation; knocking again would even open a new pending
 * knock and close the call until the counsellor answers. So the app keeps
 * the admission it saw, per conversation, on this device.
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
	if (wasAdmittedTo(sessionId)) return join();

	let conversation;
	try {
		conversation = await start(link.token);
	} catch {
		// Link switched off or gone: the server's call policy decides.
		return join();
	}
	const knock = pendingKnockFrom(link.token, conversation);
	if (!knock || knock.status === 'ADMITTED') {
		rememberAdmittedConversation(sessionId);
		return join();
	}

	admittedJoins.set(sessionId, () => void join().catch(() => undefined));
	rememberPendingKnock({ ...knock, joinExisting: true });
	announcePendingKnock();
	return 'joined';
};
