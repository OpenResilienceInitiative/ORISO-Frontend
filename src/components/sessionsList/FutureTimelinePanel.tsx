import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	apiGetChatOccurrences,
	apiSkipChatOccurrence,
	ChatOccurrence
} from '../../api/apiGetChatOccurrences';
import { apiGetConsultantAppointments } from '../../api/apiGetConsultantAppointments';
import { BookingEventsInterface } from '../../globalState/interfaces';
import { BookingsStatus } from '../../utils/consultant';
import {
	normalizeTimelineLocale,
	toSeriesApiTimestamp
} from './futureTimelineTime';
import './futureTimelinePanel.styles';

interface FutureTimelineSeries {
	id: number;
	topic: string;
	canModerate?: boolean;
}

interface FutureTimelinePanelProps {
	series: FutureTimelineSeries[];
	consultantId?: string;
	includeAppointments?: boolean;
	onDuplicateOccurrence?: (occurrence: ChatOccurrence, topic: string) => void;
}

export const FutureTimelinePanel = ({
	series,
	consultantId,
	includeAppointments = true,
	onDuplicateOccurrence
}: FutureTimelinePanelProps) => {
	const { t: translate, i18n } = useTranslation();
	const [expanded, setExpanded] = useState(false);
	const [months, setMonths] = useState(3);
	const [occurrences, setOccurrences] = useState<ChatOccurrence[]>([]);
	const [appointments, setAppointments] = useState<BookingEventsInterface[]>(
		[]
	);
	const [loading, setLoading] = useState(false);
	const [loadError, setLoadError] = useState(false);
	const [commandError, setCommandError] = useState(false);
	const [pendingSkipKeys, setPendingSkipKeys] = useState<Set<string>>(
		new Set()
	);
	const seriesQueryKey = JSON.stringify(
		series.map((item) => [item.id, item.topic, item.canModerate])
	);
	const seriesById = useMemo(
		() => new Map(series.map((item) => [item.id, item])),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[seriesQueryKey]
	);

	useEffect(() => {
		if (!expanded) {
			setOccurrences([]);
			setAppointments([]);
			setCommandError(false);
			return;
		}
		const from = new Date();
		const to = new Date(from);
		to.setMonth(to.getMonth() + months);
		setLoading(true);
		setLoadError(false);
		Promise.all([
			Promise.all(
				series.map(async (item) => {
					try {
						return {
							failed: false,
							items: await apiGetChatOccurrences(
								item.id,
								toSeriesApiTimestamp(from),
								toSeriesApiTimestamp(to),
								100
							)
						};
					} catch {
						return { failed: true, items: [] as ChatOccurrence[] };
					}
				})
			),
			consultantId && includeAppointments
				? apiGetConsultantAppointments(
						consultantId,
						BookingsStatus.ACTIVE
					).catch(() => [])
				: Promise.resolve([])
		])
			.then(([seriesResults, appointmentItems]) => {
				setLoadError(seriesResults.some((result) => result.failed));
				setOccurrences(
					seriesResults
						.flatMap((result) => result.items)
						.sort(
							(a, b) =>
								new Date(a.start).getTime() -
								new Date(b.start).getTime()
						)
				);
				setAppointments(
					appointmentItems.filter((appointment) => {
						const start = new Date(appointment.startTime);
						return start >= from && start < to;
					})
				);
			})
			.catch(() => {
				setLoadError(true);
				setOccurrences([]);
			})
			.finally(() => setLoading(false));
		// Session polling rebuilds equivalent arrays. Depend on semantic series identity so the
		// expanded timeline does not refetch on every notification/list refresh.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [consultantId, expanded, includeAppointments, months, seriesQueryKey]);

	const timelineItems = useMemo(
		() =>
			[
				...occurrences.map((occurrence) => ({
					key: `series-${occurrence.seriesId}-${occurrence.originalStart}`,
					kind: 'occurrence' as const,
					title:
						seriesById.get(occurrence.seriesId)?.topic ||
						translate('groupChat.futureTimeline.groupChatFallback'),
					start: occurrence.start,
					modality: occurrence.modality,
					occurrence,
					canModerate:
						seriesById.get(occurrence.seriesId)?.canModerate ===
						true
				})),
				...appointments.map((appointment) => ({
					key: `appointment-${appointment.id}`,
					kind: 'appointment' as const,
					title:
						appointment.title ||
						translate(
							'groupChat.futureTimeline.appointmentFallback'
						),
					start: appointment.startTime,
					detail: appointment.location
				}))
			].sort(
				(a, b) =>
					new Date(a.start).getTime() - new Date(b.start).getTime()
			),
		[appointments, occurrences, seriesById, translate]
	);

	const skipOccurrence = async (occurrence: ChatOccurrence) => {
		const key = `${occurrence.seriesId}-${occurrence.originalStart}`;
		if (pendingSkipKeys.has(key)) {
			return;
		}
		setPendingSkipKeys((current) => new Set(current).add(key));
		setCommandError(false);
		try {
			await apiSkipChatOccurrence(
				occurrence.seriesId,
				occurrence.originalStart
			);
			setOccurrences((current) =>
				current.filter(
					(item) =>
						item.seriesId !== occurrence.seriesId ||
						item.originalStart !== occurrence.originalStart
				)
			);
		} catch {
			setCommandError(true);
		} finally {
			setPendingSkipKeys((current) => {
				const next = new Set(current);
				next.delete(key);
				return next;
			});
		}
	};

	return (
		<section
			className="futureTimeline"
			aria-label={translate('groupChat.futureTimeline.ariaLabel')}
		>
			<div className="futureTimeline__divider">
				<span>{translate('groupChat.futureTimeline.now')}</span>
				<button
					type="button"
					onClick={() => setExpanded((value) => !value)}
				>
					{translate(
						expanded
							? 'groupChat.futureTimeline.hide'
							: 'groupChat.futureTimeline.show'
					)}
				</button>
			</div>
			{expanded && (
				<div className="futureTimeline__events" aria-live="polite">
					{commandError && (
						<p role="alert">
							{translate('groupChat.futureTimeline.commandError')}
						</p>
					)}
					{loadError && (
						<p role="alert">
							{translate('groupChat.futureTimeline.loadError')}
						</p>
					)}
					{loading && (
						<p>{translate('groupChat.futureTimeline.loading')}</p>
					)}
					{!loading && !timelineItems.length && (
						<p>{translate('groupChat.futureTimeline.empty')}</p>
					)}
					{timelineItems.map((item) => (
						<article key={item.key}>
							<strong>{item.title}</strong>
							<span>
								{new Date(item.start).toLocaleString(
									normalizeTimelineLocale(
										i18n.resolvedLanguage,
										i18n.language
									)
								)}{' '}
								·{' '}
								{item.kind === 'occurrence'
									? translate(
											`groupChat.create.modality.options.${item.modality.toLowerCase()}`
										)
									: item.detail}
							</span>
							{item.kind === 'occurrence' && item.canModerate && (
								<div className="futureTimeline__eventActions">
									<button
										type="button"
										disabled={pendingSkipKeys.has(
											`${item.occurrence.seriesId}-${item.occurrence.originalStart}`
										)}
										onClick={() =>
											void skipOccurrence(item.occurrence)
										}
									>
										{translate(
											'groupChat.futureTimeline.skip'
										)}
									</button>
									{onDuplicateOccurrence && (
										<button
											type="button"
											onClick={() =>
												onDuplicateOccurrence(
													item.occurrence,
													item.title
												)
											}
										>
											{translate(
												'groupChat.futureTimeline.duplicate'
											)}
										</button>
									)}
								</div>
							)}
						</article>
					))}
					<button
						type="button"
						onClick={() => setMonths((value) => value + 3)}
					>
						{translate('groupChat.futureTimeline.loadMore')}
					</button>
				</div>
			)}
		</section>
	);
};
