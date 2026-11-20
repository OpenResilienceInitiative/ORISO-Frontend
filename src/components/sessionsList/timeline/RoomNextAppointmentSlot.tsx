/**
 * The open room's next appointment below its header (ADR-021), with the same
 * menu as its twin in the list. This is the group rooms' slot, reading their
 * series; 1:1 rooms have `ConversationAppointmentSlot`.
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
import {
	canEditGroupChatSettings,
	canModerateGroupChat
} from '../../groupChat/groupChatHelpers';
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

	const roomTopic = activeSession?.item?.topic;
	const topic =
		typeof roomTopic === 'string' ? roomTopic : roomTopic?.name || '';

	useEffect(() => {
		setEntry(undefined);
		if (seriesId === undefined) return undefined;
		let active = true;
		const from = new Date();
		const to = new Date(from);
		to.setMonth(to.getMonth() + FUTURE_MONTHS);
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
								lastMessage: ''
							}
						]
					})[0]
				);
			});
		return () => {
			active = false;
		};
	}, [seriesId, topic, reload]);

	// A permission or current-room change must apply even while the same
	// occurrence is still displayed from the previous fetch.
	const canModerate =
		!!activeSession && canModerateGroupChat(activeSession, userData);
	const currentEntry =
		entry && activeSession && entry.sessionId === seriesId
			? {
					...entry,
					matrixRoomId:
						activeSession.item.matrixRoomId ||
						activeSession.rid ||
						undefined,
					canModerate,
					canDuplicate: canModerate,
					canConfigure: canEditGroupChatSettings(
						activeSession,
						userData
					)
				}
			: undefined;

	const onCancelled = useCallback(() => setReload((n) => n + 1), []);
	const onAction = useAppointmentActions({ onCancelled });

	return (
		<RoomNextAppointment
			entry={currentEntry}
			role={
				hasUserAuthority(AUTHORITIES.ASKER_DEFAULT, userData)
					? 'asker'
					: 'counsellor'
			}
			onAction={onAction}
		/>
	);
};
