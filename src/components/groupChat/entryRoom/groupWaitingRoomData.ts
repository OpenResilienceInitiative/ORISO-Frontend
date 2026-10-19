import dayjs from 'dayjs';
import { getGroupChatPlannedStart } from '../groupChatDate';
import type { GroupChatRepeat } from '../groupChatCalendar';

/**
 * What both places that show the self-help group's waiting room read from the
 * chat: the room behind the group's link (`GroupEntryRoom`) and the same room
 * in the app's chat card (`JoinGroupChatView`). One reading, so the two
 * cannot drift apart (#1219).
 */
interface GroupWaitingRoomChat {
	startDateWithTime?: string;
	startDate?: string;
	startTime?: string;
	timezone?: string;
	chatInterval?: string;
	topic?: string | { name?: string } | null;
}

/**
 * The next dates of a repeating group, for the explainer behind "Mehr
 * erfahren" — looked up, never booked (Frank, 2026-09-07). Derived from the
 * start and the interval the chat carries; a one-off group has only its own
 * date, and a group without a date has none.
 */
export const getGroupUpcomingDates = (
	chat: GroupWaitingRoomChat | undefined | null
): Date[] | undefined => {
	const start = chat ? getGroupChatPlannedStart(chat) : null;
	if (!start) {
		return undefined;
	}
	/* Calendar arithmetic, not fixed milliseconds: a month is not 30 days
	   (a 31 January start would have shown 2 March), and a day is not
	   always 24 hours — across the DST change the fixed step moved the
	   meeting by an hour. */
	const unit: 'week' | 'day' | 'month' | null =
		chat?.chatInterval === 'WEEKLY'
			? 'week'
			: chat?.chatInterval === 'DAILY'
				? 'day'
				: chat?.chatInterval === 'MONTHLY'
					? 'month'
					: null;
	if (!unit) {
		return [start];
	}
	return [0, 1, 2].map((step) => dayjs(start).add(step, unit).toDate());
};

/**
 * How the group repeats, for the rhythm under the clock and the series
 * export; unset for a one-off group.
 */
export const getGroupRepeat = (
	chat: GroupWaitingRoomChat | undefined | null
): GroupChatRepeat | undefined =>
	chat?.chatInterval === 'WEEKLY' ||
	chat?.chatInterval === 'DAILY' ||
	chat?.chatInterval === 'MONTHLY'
		? chat.chatInterval
		: undefined;

/**
 * #1499: the group's topic stays out of the waiting room until the client's
 * agreement to the group's privacy statement is on record.
 */
export const getGroupWaitingRoomTopic = (
	chat: GroupWaitingRoomChat | undefined | null,
	dataPrivacyConfirmation: unknown
): string | undefined => {
	const recorded = Boolean(
		dataPrivacyConfirmation && String(dataPrivacyConfirmation).trim() !== ''
	);
	if (!recorded || !chat?.topic) {
		return undefined;
	}
	return typeof chat.topic === 'string' ? chat.topic : chat.topic.name;
};
