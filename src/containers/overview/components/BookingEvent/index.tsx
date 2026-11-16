import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CalendarEntry } from '../../../../components/calendar/calendarModel';
import {
	CalendarEntryGlyph,
	facetOf
} from '../../../../components/calendar/CalendarEntryGlyph';
import { useEntryKindLabel } from '../../../../components/calendar/useEntryLabel';
import {
	appointmentConversationPath,
	appointmentRoomOf
} from '../../../../components/calendar/appointmentConversation';
import { startVideoCallState } from '../../../../components/call/startCallIntent';
import { Button, BUTTON_TYPES } from '../../../../components/button/Button';
import {
	formatToHHMM,
	getPrettyDateFromMessageDate,
	prettyPrintTimeDifference
} from '../../../../utils/dateHelpers';
import './booking-event.styles.scss';
import { useTranslation } from 'react-i18next';

interface BookingEventProps {
	/** One of the counsellor's own calendar appointments. */
	appointment: CalendarEntry;
}

/** From five minutes before the start, a row counts down. */
export const COUNTDOWN_START = 5 * 60 * 1000;

export const BookingEvent = ({ appointment }: BookingEventProps) => {
	const { t: translate } = useTranslation();
	const kindLabel = useEntryKindLabel();
	const navigate = useNavigate();
	const [chatFailed, setChatFailed] = useState(false);

	// Calendar times are instants: no zone shift, unlike cal.com's.
	const startTime = new Date(appointment.start);
	const endTime = new Date(appointment.end);
	const [now, setNow] = useState(() => Date.now());
	const showCountDown = startTime.getTime() - now < COUNTDOWN_START;

	// Every 5 s while counting down; otherwise every 30 s, so a row that
	// reaches the window while the overview stays open starts counting.
	useEffect(() => {
		const tick = setInterval(
			() => setNow(Date.now()),
			showCountDown ? 5000 : 30000
		);
		return () => clearInterval(tick);
	}, [showCountDown]);

	/*
	 * "Starten" on a video appointment about to start (Frank, 2026-11-16):
	 * the conversation opens the way the calendar opens it, asked to start
	 * its video call. Its own call button takes that up, with its own
	 * checks (Träger switches, consulting type, case state); the card
	 * decides nothing and starts nothing itself.
	 */
	const { sessionId } = appointment;
	const offersStart =
		showCountDown &&
		appointment.type === 'appointment' &&
		facetOf(appointment) === 'video' &&
		sessionId !== undefined;
	const startCall = () => {
		if (sessionId === undefined) return;
		setChatFailed(false);
		appointmentRoomOf(sessionId).then(
			(roomId) =>
				navigate(appointmentConversationPath(roomId, sessionId, true), {
					state: startVideoCallState(sessionId)
				}),
			() => setChatFailed(true)
		);
	};

	const prettyDate =
		!showCountDown &&
		getPrettyDateFromMessageDate(startTime.getTime() / 1000);

	return (
		<div
			className="bookingEvent"
			data-facet={facetOf(appointment)}
			data-testid="booking-event"
		>
			<div className="bookingEvent__header">
				<div className="bookingEvent__askerName">
					{appointment.title}
				</div>
			</div>

			<div className="bookingEvent__date">
				<span
					className="bookingEvent__icon"
					role="img"
					aria-label={kindLabel(appointment)}
				>
					<CalendarEntryGlyph entry={appointment} />
				</span>

				{showCountDown && (
					<div className="bookingEvent__fullDate">
						{prettyPrintTimeDifference(
							now,
							startTime.getTime(),
							true
						)}
					</div>
				)}

				{!showCountDown && (
					<div className="bookingEvent__fullDate">
						{prettyDate.str
							? translate(prettyDate.str)
							: prettyDate.date}
						,{formatToHHMM(startTime.getTime() + '')} -{' '}
						{formatToHHMM(endTime.getTime() + '')}
					</div>
				)}

				{offersStart && (
					<div className="bookingEvent__start">
						<Button
							buttonHandle={startCall}
							item={{
								label: 'overview.start',
								type: BUTTON_TYPES.PRIMARY
							}}
						/>
					</div>
				)}
			</div>
			{chatFailed && (
				<p className="bookingEvent__notice" role="alert">
					{translate('calendar.chatUnavailable')}
				</p>
			)}
		</div>
	);
};
