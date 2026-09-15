/**
 * The number on the Supervision chip (#1306).
 *
 * Frank, 14.09.2026: a supervisor could not tell from the chip that anything
 * had arrived. The count answers "is there something new in a case I
 * supervise" — so it counts UNREAD among supervised, not how many cases exist.
 *
 * `isChatItemUnread` reads the Matrix client, so it is stubbed here: these
 * tests are about which rows are counted, not about how unread is derived
 * (that is `sessionUnread`'s own suite, #1147).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const unreadRooms = new Set<string>();

vi.mock('../../utils/sessionUnread', async (importOriginal) => {
	const actual =
		await importOriginal<typeof import('../../utils/sessionUnread')>();
	return {
		...actual,
		isChatItemUnread: (
			chatItem?: { matrixRoomId?: string | null } | null
		) =>
			Boolean(
				chatItem?.matrixRoomId && unreadRooms.has(chatItem.matrixRoomId)
			)
	};
});

const { countUnreadSupervisedSessions } = await import(
	'./sessionToolbarFilters'
);

const ME = 'consultant-me';
const OWNER = 'consultant-owner';

const pair = (
	roomId: string,
	supervision: Record<string, unknown> | undefined,
	consultantId = OWNER
) => {
	const raw = {
		consultant: { id: consultantId },
		session: {
			id: roomId,
			matrixRoomId: roomId,
			messagesRead: true,
			...(supervision ? { supervision } : {})
		}
	} as any;
	return { raw, extended: { isGroup: false, item: raw.session } as any };
};

const supervisedByMe = { supervisedByMe: true, supervisorConsultantIds: [ME] };
const supervisedByOther = {
	supervisedByMe: false,
	supervisorConsultantIds: ['someone-else']
};

describe('countUnreadSupervisedSessions', () => {
	beforeEach(() => unreadRooms.clear());

	it('counts a supervised row that is unread', () => {
		unreadRooms.add('!a:hs');
		expect(
			countUnreadSupervisedSessions([pair('!a:hs', supervisedByMe)], ME)
		).toBe(1);
	});

	it('does not count a supervised row that has been read', () => {
		expect(
			countUnreadSupervisedSessions([pair('!a:hs', supervisedByMe)], ME)
		).toBe(0);
	});

	it('does not count an unread row somebody ELSE supervises', () => {
		unreadRooms.add('!b:hs');
		expect(
			countUnreadSupervisedSessions(
				[pair('!b:hs', supervisedByOther)],
				ME
			)
		).toBe(0);
	});

	it('does not count an unread row with no marker at all', () => {
		// The chip FILTER still falls back to the old heuristic for old
		// backends, but a number derived from a guess would tell the
		// supervisor that something arrived when nothing did.
		unreadRooms.add('!c:hs');
		expect(
			countUnreadSupervisedSessions([pair('!c:hs', undefined)], ME)
		).toBe(0);
	});

	it('counts several and ignores the read ones in the same list', () => {
		unreadRooms.add('!a:hs');
		unreadRooms.add('!c:hs');
		expect(
			countUnreadSupervisedSessions(
				[
					pair('!a:hs', supervisedByMe),
					pair('!b:hs', supervisedByMe),
					pair('!c:hs', supervisedByMe),
					pair('!d:hs', supervisedByOther)
				],
				ME
			)
		).toBe(2);
	});

	it('is zero without a signed-in user id rather than counting everything', () => {
		unreadRooms.add('!a:hs');
		expect(
			countUnreadSupervisedSessions(
				[pair('!a:hs', supervisedByMe)],
				undefined
			)
		).toBe(0);
	});

	it('is zero for an empty list', () => {
		expect(countUnreadSupervisedSessions([], ME)).toBe(0);
	});
});
