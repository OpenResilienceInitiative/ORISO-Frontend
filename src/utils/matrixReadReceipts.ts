/**
 * Read status of own messages from Matrix read receipts (FE#1802).
 *
 * The SDK's `hasUserReadEvent` decides per reader: a receipt at or after the
 * event, or the reader having sent the latest message, counts as read.
 *
 * Who counts as a reader:
 * - `readers` given → only those Matrix ids (see `counterpartReaders`).
 * - otherwise → any joined member other than me. One reader is enough: in a
 *   group, team or supervision room "read" means someone saw it, not that
 *   everyone did — waiting for all would leave messages "sent" forever
 *   whenever one member never opens the room.
 */

const myUserIdOf = (room: any): string =>
	room?.myUserId || room?.client?.getUserId?.() || '';

/**
 * Returns, per event, `true` (own, unread), `false` (own, read) or
 * `undefined` (not ours). One pass newest → oldest: once a reader has read
 * an own message, every older one is read too (one timeline — the client
 * runs without thread support), so the SDK's O(n) ordering check runs only
 * for the unread tail instead of for every message.
 */
export const ownReadStatus = (
	events: any[],
	room: any,
	readers?: string[]
): ((event: any) => boolean | undefined) => {
	const me = myUserIdOf(room);
	if (!me) return () => undefined;
	const candidates = (
		readers ??
		(room?.getJoinedMembers?.() || []).map((member: any) => member.userId)
	).filter((userId: string) => Boolean(userId) && userId !== me);
	const canCheck = typeof room?.hasUserReadEvent === 'function';

	const unread = new Set<any>();
	let readFromHere = false;
	for (let index = (events || []).length - 1; index >= 0; index--) {
		const event = events[index];
		if (event?.getSender?.() !== me) continue;
		const eventId = event?.getId?.();
		if (!readFromHere && eventId && canCheck) {
			readFromHere = candidates.some((userId: string) =>
				room.hasUserReadEvent(userId, eventId)
			);
		}
		if (!readFromHere) unread.add(event);
	}

	return (event: any) =>
		event?.getSender?.() === me ? unread.has(event) : undefined;
};

/**
 * The 1:1 counterpart from session data, never from room membership
 * (ADR-002): the asker for a counsellor, the assigned counsellor for the
 * asker. A silent colleague opening the room must not make a message "read".
 * `undefined` (group, or counterpart unknown, e.g. an unassigned enquiry)
 * falls back to any other member.
 */
export const counterpartReaders = (
	session: {
		isGroup?: boolean;
		item?: { askerMatrixUserId?: string; consultantMatrixUserId?: string };
	},
	me: string | null | undefined
): string[] | undefined => {
	if (session?.isGroup || !me) return undefined;
	const { askerMatrixUserId: asker, consultantMatrixUserId: counsellor } =
		session?.item || {};
	const counterpart = me === asker ? counsellor : asker;
	return counterpart && counterpart !== me ? [counterpart] : undefined;
};
