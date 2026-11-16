import React, { useEffect, useState } from 'react';
import type { CalendarEntry } from '../../../../components/calendar/calendarModel';
import {
	formatToHHMM,
	getPrettyDateFromMessageDate,
	prettyPrintTimeDifference
} from '../../../../utils/dateHelpers';
import { ReactComponent as CameraOnIcon } from '../../../../resources/img/icons/camera-on.svg';
import './booking-event.styles.scss';
import { useTranslation } from 'react-i18next';

interface BookingEventProps {
	/** One of the counsellor's own calendar appointments. */
	appointment: CalendarEntry;
}

const COUNTDOWN_START = 5 * 60 * 1000;

export const BookingEvent = ({ appointment }: BookingEventProps) => {
	const { t: translate } = useTranslation();

	// Calendar times are instants: no zone shift, unlike cal.com's.
	const startTime = new Date(appointment.start);
	const endTime = new Date(appointment.end);
	const showCountDown = startTime.getTime() - Date.now() < COUNTDOWN_START;
	const [countdown, setCountdown] = useState(showCountDown && Date.now());

	useEffect(() => {
		if (showCountDown) {
			const rel = setInterval(() => setCountdown(Date.now()), 5000);
			return () => clearInterval(rel);
		}
	}, [showCountDown]);

	const prettyDate =
		!showCountDown &&
		getPrettyDateFromMessageDate(startTime.getTime() / 1000);

	return (
		<div className="bookingEvent">
			<div className="bookingEvent__header">
				<div className="bookingEvent__askerName">
					{appointment.title}
				</div>
			</div>

			<div className="bookingEvent__date">
				<div className="bookingEvent__icon">
					<CameraOnIcon />
				</div>

				{showCountDown && (
					<>
						<div className="bookingEvent__fullDate">
							{prettyPrintTimeDifference(
								countdown,
								startTime.getTime(),
								true
							)}
						</div>
						<div className="bookingEvent__start">
							{translate(
								'legacyVideoAppointment.unavailable.message'
							)}
						</div>
					</>
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
			</div>
		</div>
	);
};
