import React, { useEffect, useState } from 'react';
import { BookingEventsInterface } from '../../../../globalState/interfaces/BookingsInterface';
import {
	convertUTCDateToLocalDate,
	formatToHHMM,
	getPrettyDateFromMessageDate,
	prettyPrintTimeDifference
} from '../../../../utils/dateHelpers';
import { ReactComponent as CameraOnIcon } from '../../../../resources/img/icons/camera-on.svg';
import './booking-event.styles.scss';
import { useTranslation } from 'react-i18next';

interface BookingEventProps {
	booking: BookingEventsInterface;
}

const COUNTDOWN_START = 5 * 60 * 1000;

export const BookingEvent = ({ booking }: BookingEventProps) => {
	const { t: translate } = useTranslation();

	const startTime = new Date(
		convertUTCDateToLocalDate(new Date(booking.startTime))
	);
	const endTime = new Date(
		convertUTCDateToLocalDate(new Date(booking.endTime))
	);
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
					{booking.askerName}
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
