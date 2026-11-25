import { describe, expect, it } from 'vite-plus/test';
import type { NotificationFeedItem } from '../../../globalState/provider/NotificationsProvider';
import {
	MAX_WAITING_CONVERSATIONS,
	waitingConversations,
	WAITING_GUEST_WINDOW_MS
} from './waitingGuests';

const NOW = Date.parse('2026-11-25T13:00:00Z');

const entry = (
	sessionId: number,
	minutesAgo: number,
	overrides: Partial<NotificationFeedItem> = {}
): NotificationFeedItem =>
	({
		id: `${sessionId}-${minutesAgo}`,
		type: 'info',
		title: '',
		text: '',
		eventType: 'call.knock.requested',
		createdAt: new Date(NOW - minutesAgo * 60_000).toISOString(),
		category: 'system',
		actionPath: `/sessions/consultant/sessionView/!room${sessionId}:oriso/${sessionId}`,
		params: {
			sessionId,
			roomRef: `!room${sessionId}:oriso`,
			medium: 'VIDEO'
		},
		...overrides
	}) as unknown as NotificationFeedItem;

describe('waitingConversations', () => {
	it('names the conversation, its room, the medium and where it opens', () => {
		expect(waitingConversations([entry(294, 1)], NOW)).toEqual([
			{
				sessionId: 294,
				roomId: '!room294:oriso',
				isVideo: true,
				path: '/sessions/consultant/sessionView/!room294:oriso/294'
			}
		]);
	});

	it('counts an entry the counsellor already read: reading lets nobody in', () => {
		const read = entry(294, 1, { readAt: '2026-11-25T12:59:30Z' });
		expect(waitingConversations([read], NOW)).toHaveLength(1);
	});

	it('lists the conversation waiting longest first, each once', () => {
		const list = waitingConversations(
			[entry(2, 3), entry(1, 30), entry(1, 50), entry(3, 10)],
			NOW
		);
		// Conversation 1 knocked again 30 minutes ago: that entry counts.
		expect(list.map((c) => c.sessionId)).toEqual([1, 3, 2]);
	});

	it('leaves out other events, old entries and entries without a room', () => {
		const old = entry(5, WAITING_GUEST_WINDOW_MS / 60_000 + 1);
		const other = entry(6, 1, { eventType: 'call.ended' });
		const roomless = entry(7, 1, {
			params: { sessionId: 7, medium: 'AUDIO' }
		} as Partial<NotificationFeedItem>);
		expect(waitingConversations([old, other, roomless], NOW)).toEqual([]);
	});

	it('reads an audio knock as an audio call', () => {
		const audio = entry(8, 1, {
			params: { sessionId: 8, roomRef: '!a:oriso', medium: 'AUDIO' }
		} as Partial<NotificationFeedItem>);
		expect(waitingConversations([audio], NOW)[0].isVideo).toBe(false);
	});

	it('asks about a handful of conversations at most, the newest ones', () => {
		const many = Array.from(
			{ length: MAX_WAITING_CONVERSATIONS + 3 },
			(_, index) => entry(index + 1, 100 - index)
		);
		const list = waitingConversations(many, NOW);
		expect(list).toHaveLength(MAX_WAITING_CONVERSATIONS);
		expect(list[list.length - 1].sessionId).toBe(many.length);
	});
});
