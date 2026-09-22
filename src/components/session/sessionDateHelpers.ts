import { getValidTimeFormatForSelectedTime } from '../groupChat/createChatHelpers';

export const getChatDate = (startDate, startTime) => {
	// Read the calendar day from the string: new Date('YYYY-MM-DD') is UTC
	// midnight, the previous day west of Greenwich (#1499).
	const [year, month, day] = String(startDate)
		.slice(0, 10)
		.split('-')
		.map(Number);
	return new Date(
		year,
		month - 1,
		day,
		Number(startTime.slice(0, 2)),
		Number(startTime.slice(3, 5))
	);
};

/**
 * The group's own timezone as a short label — but only when it differs from the
 * reader's. `startTime` is the group's wall clock, so someone in another zone
 * sees the same digits and would otherwise read them as their own time (#1293).
 */
export const getGroupChatTimezoneSuffix = (timezone?: string): string => {
	if (!timezone) {
		return '';
	}
	let viewerTimezone: string | undefined;
	try {
		viewerTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
	} catch {
		return '';
	}
	if (!viewerTimezone || viewerTimezone === timezone) {
		return '';
	}
	const city = timezone.split('/').pop()?.replace(/_/g, ' ');
	return city ? ` (${city})` : '';
};

export const getGroupChatDate = (
	listItem,
	postFixTranslation: string,
	isShortVersion?: boolean,
	onlyStartDate?: boolean,
	onlyStartTime?: boolean
) => {
	const startDate = listItem.startDate;
	const startTime = listItem.startTime;
	const duration = listItem.duration;
	const chatDate = getChatDate(startDate, startTime);
	const timezoneSuffix = getGroupChatTimezoneSuffix(listItem.timezone);

	const startDateFormatOptions =
		listItem.repetitive && !onlyStartDate
			? { weekday: 'short' }
			: {
					weekday: 'short',
					year: '2-digit',
					month: '2-digit',
					day: '2-digit'
				};
	const newStartDate = chatDate.toLocaleDateString(
		'de-DE',
		startDateFormatOptions as any
	);
	const formatedStartDate = newStartDate.slice(0, 2) + newStartDate.slice(3);

	const formatedStartTime = getValidTimeFormatForSelectedTime(chatDate);
	const formatedEndTime = getValidTimeFormatForSelectedTime(
		new Date(chatDate.getTime() + duration * 60000)
	);

	if (isShortVersion) {
		return `${formatedStartTime} ${postFixTranslation} - ${formatedEndTime} ${postFixTranslation}${timezoneSuffix}`;
	} else if (onlyStartDate) {
		return formatedStartDate;
	} else if (onlyStartTime) {
		return `${formatedStartTime} ${postFixTranslation}${timezoneSuffix}`;
	} else {
		return `${formatedStartDate}${
			listItem.repetitive ? '' : ','
		} ${formatedStartTime} ${postFixTranslation} - ${formatedEndTime} ${postFixTranslation}${timezoneSuffix}`;
	}
};
