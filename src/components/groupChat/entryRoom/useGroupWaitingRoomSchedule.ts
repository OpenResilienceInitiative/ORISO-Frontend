import { useEffect, useState } from 'react';
import {
	apiGetChatOccurrences,
	type ChatOccurrence
} from '../../../api/apiGetChatOccurrences';
import { onAppointmentsChanged } from '../../sessionsList/timeline/conversationAppointments';
import { isGroupChatRepeat } from '../groupChatSeries';
import {
	getGroupUpcomingDates,
	getGroupWaitingRoomSchedule,
	type GroupWaitingRoomChat
} from './groupWaitingRoomData';

const DAY = 86_400_000;
const MAX_OCCURRENCES = 100;

const loadOccurrences = async (
	seriesId: number,
	from: number,
	to: number
): Promise<ChatOccurrence[]> => {
	const rows = await apiGetChatOccurrences(
		seriesId,
		new Date(from).toISOString(),
		new Date(to).toISOString(),
		MAX_OCCURRENCES
	);
	if (rows.length < MAX_OCCURRENCES || to - from <= 1000) return rows;

	// The endpoint caps responses at 100. Split the interval to keep long series complete.
	const middle = Math.floor((from + to) / 2);
	const left = await loadOccurrences(seriesId, from, middle);
	return left.concat(await loadOccurrences(seriesId, middle, to));
};

export const useGroupWaitingRoomSchedule = (chat?: GroupWaitingRoomChat) => {
	const seriesId =
		chat &&
		(chat.repeatCount ?? 0) > 1 &&
		isGroupChatRepeat(chat.chatInterval)
			? chat.id
			: undefined;
	const planned =
		seriesId === undefined ? undefined : getGroupUpcomingDates(chat);
	const lastPlanned = planned?.at(-1)?.getTime();
	const lookBack = Math.max(DAY, (chat?.duration ?? 0) * 60_000);
	const [projection, setProjection] = useState<{
		seriesId: number;
		occurrences?: ChatOccurrence[];
	}>();

	useEffect(() => {
		if (seriesId === undefined) return;
		let request = 0;
		const refresh = (allowLegacyFallback: boolean) => {
			const current = ++request;
			const now = Date.now();
			// Include the scheduled window even if a moderator has not opened it yet.
			const from = now - lookBack;
			const to = Math.max(now + 93 * DAY, (lastPlanned ?? now) + DAY);
			if (!allowLegacyFallback)
				setProjection({ seriesId, occurrences: [] });
			void loadOccurrences(seriesId, from, to).then(
				(occurrences) => {
					if (request === current)
						setProjection({ seriesId, occurrences });
				},
				(error: unknown) => {
					if (request !== current) return;
					// Only an unsupported projection may use the legacy dates on
					// initial load. Other errors cannot confirm those dates.
					const unsupported =
						error instanceof Response &&
						(error.status === 404 || error.status === 501);
					setProjection({
						seriesId,
						occurrences:
							allowLegacyFallback && unsupported ? undefined : []
					});
				}
			);
		};
		refresh(true);
		const unsubscribe = onAppointmentsChanged(() => refresh(false));
		return () => {
			request++;
			unsubscribe();
		};
	}, [seriesId, lookBack, lastPlanned]);

	const occurrences =
		seriesId === undefined
			? undefined
			: projection?.seriesId === seriesId
				? projection.occurrences
				: [];
	return getGroupWaitingRoomSchedule(chat, occurrences);
};
