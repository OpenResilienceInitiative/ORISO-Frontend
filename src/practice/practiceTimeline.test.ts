// @vitest-environment oriso-jsdom
import { describe, expect, it, vi } from 'vite-plus/test';
import { createPracticeTimeline } from './practiceTimeline';
import { createTestScript } from './script/scriptTestSupport';
import { practiceAcceptedSessionRoute } from './practiceRoutes';
import {
	isPracticeId,
	PRACTICE_MAIN_ROOM_ID,
	PRACTICE_TEAM_ROOM_ID
} from './practiceIds';
import { getEventDescriptor } from '../components/notificationsCenter/eventDescriptors';
import { isTimelineDraftId } from '../components/notificationsCenter/timelineDrafts';

const script = createTestScript('de');
const NOW = Date.parse('2026-11-25T10:00:00Z');
const timeline = () => createPracticeTimeline({ script, now: () => NOW });

describe('practice timeline (FE#2545)', () => {
	it('shows a new message from the advice seeker, a read accept and a new team message, newest first', () => {
		const feed = timeline().getFeed();
		expect(
			feed.map(({ eventType, readAt, createdAt }) => [
				eventType,
				readAt ? 'read' : 'unread',
				createdAt
			])
		).toEqual([
			['message.new', 'unread', '2026-11-25T09:50:00.000Z'],
			['inquiry.accepted', 'read', '2026-11-25T09:39:00.000Z'],
			['team.discussion.new', 'unread', '2026-11-25T09:35:00.000Z']
		]);
		// Every event type is a real one with its own descriptor.
		feed.forEach(({ eventType }) =>
			expect(getEventDescriptor(eventType).eventType).toBe(eventType)
		);
	});

	it('leads every entry to the practice conversation, never to a real one', () => {
		const feed = timeline().getFeed();
		feed.forEach((item) => {
			expect(isPracticeId(item.id)).toBe(true);
			expect(isTimelineDraftId(item.id)).toBe(false);
			expect(item.actionPath).toBe(practiceAcceptedSessionRoute());
			expect(item.sourceSessionId).toBeUndefined();
		});
		expect(feed.map((item) => item.params?.roomRef)).toEqual([
			PRACTICE_MAIN_ROOM_ID,
			PRACTICE_MAIN_ROOM_ID,
			PRACTICE_TEAM_ROOM_ID
		]);
		expect(feed[0].params?.senderDisplayName).toBe(
			script.cast.asker.displayName
		);
		expect(feed[2].params?.senderDisplayName).toBe(
			script.cast.colleague.displayName
		);
	});

	it('marks one entry, then all, as read in memory and tells its readers', () => {
		const practice = timeline();
		const listener = vi.fn();
		const off = practice.subscribe(listener);
		const [message, , team] = practice.getFeed();
		expect(practice.unreadCount()).toBe(2);

		const before = practice.getFeed();
		practice.markRead(message.id);
		expect(practice.getFeed()).not.toBe(before);
		expect(practice.getFeed()[0].readAt).toBe('2026-11-25T10:00:00.000Z');
		expect(practice.unreadCount()).toBe(1);
		expect(listener).toHaveBeenCalledTimes(1);

		// Reading a read or unknown entry changes nothing.
		const unchanged = practice.getFeed();
		practice.markRead(message.id);
		practice.markRead('4711');
		expect(practice.getFeed()).toBe(unchanged);
		expect(listener).toHaveBeenCalledTimes(1);

		practice.markAllRead();
		expect(practice.unreadCount()).toBe(0);
		expect(
			practice.getFeed().find((item) => item.id === team.id)?.readAt
		).toBe('2026-11-25T10:00:00.000Z');
		expect(listener).toHaveBeenCalledTimes(2);

		off();
		practice.markAllRead();
		expect(listener).toHaveBeenCalledTimes(2);
	});

	it('starts fresh for every run', () => {
		const first = timeline();
		first.markAllRead();
		expect(timeline().unreadCount()).toBe(2);
	});
});
