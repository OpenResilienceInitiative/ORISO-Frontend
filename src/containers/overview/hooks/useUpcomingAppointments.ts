import { useContext, useEffect, useState } from 'react';
import { apiGetCalendarEntries } from '../../../api/apiCalendar';
import { UserDataContext } from '../../../globalState';
import { entryFromApi } from '../../../components/calendar/calendarApiMapping';
import {
	upcomingEntries,
	type CalendarEntry
} from '../../../components/calendar/calendarModel';

/** How far ahead the overview looks for the next appointments. */
export const UPCOMING_DAYS = 30;

/**
 * The counsellor's next own appointments for the overview, from the
 * calendar: the selection "Als Nächstes" shows (own, not over, nearest
 * first, at most five). A failure shows as none, like before.
 */
export const useUpcomingAppointments = () => {
	const { userData } = useContext(UserDataContext);
	const [appointments, setAppointments] = useState<CalendarEntry[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;
		const now = new Date();
		// From midnight, so a running appointment is part of the answer.
		const from = new Date(now);
		from.setHours(0, 0, 0, 0);
		const to = new Date(from);
		to.setDate(to.getDate() + UPCOMING_DAYS);
		setIsLoading(true);
		apiGetCalendarEntries(from, to)
			.then(
				(dtos) => {
					if (!cancelled)
						setAppointments(
							upcomingEntries(
								dtos.map(entryFromApi),
								userData.userId,
								now
							)
						);
				},
				() => {
					if (!cancelled) setAppointments([]);
				}
			)
			.finally(() => {
				if (!cancelled) setIsLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [userData.userId]);

	return { appointments, isLoading };
};
