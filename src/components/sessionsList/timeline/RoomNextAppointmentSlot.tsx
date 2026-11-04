/**
 * The open room's next appointment below its header (ADR-021), with the same
 * menu as its twin in the list. Group rooms read their series; 1:1 rooms stay
 * empty until a booking carries its session id (appointment service, ADR-021
 * follow-up) — without it a booking cannot be tied to a room.
 */
import * as React from 'react';
import { useCallback, useContext, useEffect, useState } from 'react';
import {
	ActiveSessionContext,
	AUTHORITIES,
	hasUserAuthority,
	UserDataContext
} from '../../../globalState';
import {
	apiGetChatOccurrences,
	type ChatOccurrence
} from '../../../api/apiGetChatOccurrences';
import { canModerateGroupChat } from '../../groupChat/groupChatHelpers';
import { toSeriesApiTimestamp } from '../futureTimelineTime';
import { RoomNextAppointment } from './AppointmentSplitButton';
import { FUTURE_MONTHS } from './useFutureEntries';
import { useAppointmentActions } from './useAppointmentActions';
import { buildFutureEntries, type FutureEntry } from './timelineModel';

export const RoomNextAppointmentSlot = () => {
	const { activeSession } = useContext(ActiveSessionContext);
	const { userData } = useContext(UserDataContext);
	const [entry, setEntry] = useState<FutureEntry>();
	const [reload, setReload] = useState(0);
	const seriesId =
		activeSession?.isGroup && activeSession.item.repeatCount !== undefined
			? activeSession.item.id
			: undefined;

	useEffect(() => {
		setEntry(undefined);
		if (seriesId === undefined || !activeSession) return undefined;
		let active = true;
		const from = new Date();
		const to = new Date(from);
		to.setMonth(to.getMonth() + FUTURE_MONTHS);
		const topic =
			typeof activeSession.item.topic === 'string'
				? activeSession.item.topic
				: activeSession.item.topic?.name || '';
		apiGetChatOccurrences(
			seriesId,
			toSeriesApiTimestamp(from),
			toSeriesApiTimestamp(to),
			1
		)
			.catch(() => [] as ChatOccurrence[])
			.then((occurrences) => {
				if (!active) return;
				setEntry(
					buildFutureEntries({
						now: new Date(),
						occurrences,
						bookings: [],
						seriesToSession: { [seriesId]: seriesId },
						sessions: [
							{
								sessionId: seriesId,
								title: topic,
								kind: 'group',
								topic,
								lastActivity: 0,
								lastMessage: '',
								matrixRoomId:
									activeSession.item.matrixRoomId ||
									activeSession.rid ||
									undefined,
								canModerate: canModerateGroupChat(
									activeSession,
									userData
								)
							}
						]
					})[0]
				);
			});
		return () => {
			active = false;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [seriesId, reload]);

	const onCancelled = useCallback(() => setReload((n) => n + 1), []);
	const onAction = useAppointmentActions({ onCancelled });

	return (
		<RoomNextAppointment
			entry={entry}
			role={
				hasUserAuthority(AUTHORITIES.ASKER_DEFAULT, userData)
					? 'asker'
					: 'counsellor'
			}
			onAction={onAction}
		/>
	);
};
