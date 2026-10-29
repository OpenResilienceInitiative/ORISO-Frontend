import { getGroupChatPlannedStart } from '../groupChatDate';
import {
	getGroupChatOccurrences,
	isGroupChatRepeat,
	type GroupChatSeries
} from '../groupChatSeries';

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
	repeatCount?: number;
	currentOccurrenceIndex?: number;
	topic?: string | { name?: string } | null;
}

/**
 * The series from the date the chat carries on: how it repeats and how many
 * dates are left including that one. The chat's start is its current date
 * (`currentOccurrenceIndex`, from 0), so `repeatCount` minus that index are
 * left — the UserService's `Chat.nextStart` stops at the same place. Unset
 * for a one-off group and on a series' last date.
 */
export const getGroupSeries = (
	chat: GroupWaitingRoomChat | undefined | null
): GroupChatSeries | undefined => {
	if (!chat || !isGroupChatRepeat(chat.chatInterval)) {
		return undefined;
	}
	const count = (chat.repeatCount ?? 0) - (chat.currentOccurrenceIndex ?? 0);
	return count > 1
		? {
				repeat: chat.chatInterval,
				count,
				timeZone: chat.timezone || undefined
			}
		: undefined;
};

/**
 * The dates still left of a group, for "Alle Termine" — looked up, never
 * booked (Frank, 2026-09-07). All of them, so each one can go into a
 * calendar on its own; a one-off group has only its own date, and a group
 * without a date has none.
 */
export const getGroupUpcomingDates = (
	chat: GroupWaitingRoomChat | undefined | null
): Date[] | undefined => {
	const start = chat ? getGroupChatPlannedStart(chat) : null;
	if (!start) {
		return undefined;
	}
	const series = getGroupSeries(chat);
	return series ? getGroupChatOccurrences(start, series) : [start];
};

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
