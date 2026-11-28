import {
	NOTIFICATION_TYPE_INFO,
	type NotificationFeedItem
} from '../globalState/provider/NotificationsProvider';
import { practiceAcceptedSessionRoute } from './practiceRoutes';
import {
	practiceStringId,
	PRACTICE_MAIN_ROOM_ID,
	PRACTICE_TEAM_ROOM_ID
} from './practiceIds';
import type { ScriptEngine } from './script/ScriptEngine';

/**
 * The Zeitstrahl of the practice world (FE#2545): what the timeline tour's
 * counsellor finds, and every read state it changes, in memory. The sandbox
 * hands it to the practice view in place of the real feed; it never reaches
 * the real provider, the server or the badge in the navigation.
 */
export interface PracticeTimeline {
	/** Newest first; a new array after every change, the same one otherwise. */
	getFeed(): NotificationFeedItem[];
	subscribe(listener: () => void): () => void;
	unreadCount(): number;
	markRead(id: string): void;
	markAllRead(): void;
}

const MINUTE = 60_000;

/**
 * The entries match the practice case (`practiceScenario`, accepted): the
 * advice seeker's latest reply came ten minutes ago, the counsellor accepted
 * the enquiry before her first answer, and the colleague wrote in the team
 * chat five minutes after the enquiry. On a desktop the Zeitstrahl opens its
 * newest entry and reads it, so the reply is read on arrival and the
 * team-chat entry is left for "Alle als gelesen markieren". Every entry
 * leads to the practice case; none names a real session id.
 */
const seedFeed = (
	script: ScriptEngine,
	now: number
): NotificationFeedItem[] => {
	const at = (minutesAgo: number) =>
		new Date(now - minutesAgo * MINUTE).toISOString();
	const entry = (
		n: number,
		eventType: string,
		category: NotificationFeedItem['category'],
		minutesAgo: number,
		read: boolean,
		params: NotificationFeedItem['params']
	): NotificationFeedItem => ({
		id: practiceStringId('timeline', n),
		type: NOTIFICATION_TYPE_INFO,
		title: '',
		text: '',
		eventType,
		category,
		createdAt: at(minutesAgo),
		readAt: read ? at(minutesAgo) : null,
		actionPath: practiceAcceptedSessionRoute(),
		params
	});
	return [
		entry(1, 'message.new', 'message', 10, false, {
			roomRef: PRACTICE_MAIN_ROOM_ID,
			senderDisplayName: script.cast.asker.displayName
		}),
		entry(2, 'inquiry.accepted', 'system', 21, true, {
			roomRef: PRACTICE_MAIN_ROOM_ID
		}),
		entry(3, 'team.discussion.new', 'message', 25, false, {
			roomRef: PRACTICE_TEAM_ROOM_ID,
			senderDisplayName: script.cast.colleague.displayName
		})
	];
};

export const createPracticeTimeline = ({
	script,
	now = Date.now
}: {
	script: ScriptEngine;
	now?: () => number;
}): PracticeTimeline => {
	let feed = seedFeed(script, now());
	const listeners = new Set<() => void>();

	const readWhere = (matches: (item: NotificationFeedItem) => boolean) => {
		if (!feed.some((item) => !item.readAt && matches(item))) return;
		const readAt = new Date(now()).toISOString();
		feed = feed.map((item) =>
			!item.readAt && matches(item) ? { ...item, readAt } : item
		);
		listeners.forEach((listener) => listener());
	};

	return {
		getFeed: () => feed,
		subscribe: (listener) => {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		unreadCount: () => feed.filter((item) => !item.readAt).length,
		markRead: (id) => readWhere((item) => item.id === id),
		markAllRead: () => readWhere(() => true)
	};
};
