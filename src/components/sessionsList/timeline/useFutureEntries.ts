/**
 * Loads what the list shows above "Jetzt" (ADR-021): the dates of every
 * group series in the list and the viewer's 1:1 appointments, three months
 * ahead like the old future strip. Failures (a backend without the endpoint,
 * too) leave that source out; the list never waits for them.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	apiGetChatOccurrences,
	type ChatOccurrence
} from '../../../api/apiGetChatOccurrences';
import {
	apiGetUpcomingAppointments,
	type SessionAppointment
} from '../../../api/apiSessionAppointments';
import { toSeriesApiTimestamp } from '../futureTimelineTime';
import {
	appointmentToBooking,
	onAppointmentsChanged
} from './conversationAppointments';
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
	/** The list's 1:1 conversations: an appointment's twin takes their name and room. */
	conversations: TimelineSession[];
	enabled: boolean;
}

export const useFutureEntries = ({
	series,
	conversations,
	enabled
}: UseFutureEntriesOptions) => {
	const [occurrences, setOccurrences] = useState<ChatOccurrence[]>([]);
	const [appointments, setAppointments] = useState<SessionAppointment[]>([]);
	const [reload, setReload] = useState(0);
	const [cancelled, setCancelled] = useState<Set<string>>(new Set());
	// List polling rebuilds equal arrays: load again only when the series change.
	const seriesKey = series.map((s) => s.sessionId).join(',');
	const conversationsKey = conversations
		.map((c) => `${c.sessionId}:${c.title}:${c.matrixRoomId}`)
		.join(',');

	useEffect(() => onAppointmentsChanged(() => setReload((n) => n + 1)), []);

	useEffect(() => {
		if (!enabled) {
			setOccurrences([]);
			setAppointments([]);
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
		apiGetUpcomingAppointments()
			.catch(() => [] as SessionAppointment[])
			.then(
				(items) =>
					active &&
					Array.isArray(items) &&
					setAppointments(
						items.filter((a) => new Date(a.startTime) < to)
					)
			);
		return () => {
			active = false;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [enabled, seriesKey, reload]);

	const entries = useMemo<FutureEntry[]>(
		() =>
			buildFutureEntries({
				now: new Date(),
				occurrences,
				bookings: appointments.map(appointmentToBooking),
				seriesToSession: Object.fromEntries(
					series.map((s) => [s.sessionId, s.sessionId])
				),
				sessions: [...series, ...conversations]
			}).filter((entry) => !cancelled.has(entry.key)),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[occurrences, appointments, seriesKey, conversationsKey, cancelled]
	);

	const markCancelled = useCallback(
		(entry: FutureEntry) =>
			setCancelled((current) => new Set(current).add(entry.key)),
		[]
	);

	return { entries, markCancelled };
};
