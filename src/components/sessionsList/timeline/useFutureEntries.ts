/**
 * Loads what the list shows above "Jetzt" (ADR-021): the dates of every
 * group series in the list and the viewer's 1:1 bookings, three months
 * ahead like the old future strip. Failures leave that source out; the
 * list never waits for them.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	apiGetChatOccurrences,
	type ChatOccurrence
} from '../../../api/apiGetChatOccurrences';
import { apiGetConsultantAppointments } from '../../../api/apiGetConsultantAppointments';
import { apiAppointmentsServiceBookingEventsByAskerId } from '../../../api/apiGetAppointmentsServiceBookingEventsByUserId';
import type { BookingEventsInterface } from '../../../globalState/interfaces/BookingsInterface';
import { BookingsStatus } from '../../../utils/consultant';
import { toSeriesApiTimestamp } from '../futureTimelineTime';
import {
	buildFutureEntries,
	type FutureEntry,
	type TimelineSession
} from './timelineModel';

export const FUTURE_MONTHS = 3;
const OCCURRENCE_LIMIT = 100;

export interface UseFutureEntriesOptions {
	/** Group sessions with a series (`item.id` is the series id). */
	series: TimelineSession[];
	userId?: string;
	isAsker: boolean;
	enabled: boolean;
}

export const useFutureEntries = ({
	series,
	userId,
	isAsker,
	enabled
}: UseFutureEntriesOptions) => {
	const [occurrences, setOccurrences] = useState<ChatOccurrence[]>([]);
	const [bookings, setBookings] = useState<BookingEventsInterface[]>([]);
	const [cancelled, setCancelled] = useState<Set<string>>(new Set());
	// List polling rebuilds equal arrays: load again only when the series change.
	const seriesKey = series.map((s) => s.sessionId).join(',');

	useEffect(() => {
		if (!enabled) {
			setOccurrences([]);
			setBookings([]);
			return undefined;
		}
		let active = true;
		const from = new Date();
		const to = new Date(from);
		to.setMonth(to.getMonth() + FUTURE_MONTHS);
		Promise.all(
			series.map((s) =>
				apiGetChatOccurrences(
					s.sessionId,
					toSeriesApiTimestamp(from),
					toSeriesApiTimestamp(to),
					OCCURRENCE_LIMIT
				).catch(() => [] as ChatOccurrence[])
			)
		).then((results) => active && setOccurrences(results.flat()));
		if (userId) {
			(isAsker
				? apiAppointmentsServiceBookingEventsByAskerId(userId)
				: apiGetConsultantAppointments(userId, BookingsStatus.ACTIVE)
			)
				.catch(() => [] as BookingEventsInterface[])
				.then(
					(items) =>
						active &&
						setBookings(
							items.filter((b) => new Date(b.startTime) < to)
						)
				);
		}
		return () => {
			active = false;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [enabled, seriesKey, userId, isAsker]);

	const entries = useMemo<FutureEntry[]>(
		() =>
			buildFutureEntries({
				now: new Date(),
				occurrences,
				bookings: bookings.map((b) => ({
					id: b.id,
					startTime: b.startTime,
					location: b.location,
					uid: b.uid,
					rescheduleLink: b.rescheduleLink,
					askerId: b.askerId,
					askerName: b.askerName,
					title: b.title
				})),
				seriesToSession: Object.fromEntries(
					series.map((s) => [s.sessionId, s.sessionId])
				),
				sessions: series
			}).filter((entry) => !cancelled.has(entry.key)),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[occurrences, bookings, seriesKey, cancelled]
	);

	const markCancelled = useCallback(
		(entry: FutureEntry) =>
			setCancelled((current) => new Set(current).add(entry.key)),
		[]
	);

	return { entries, markCancelled };
};
