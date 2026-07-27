import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import '../booking.styles';
import { Box } from '../../../../components/box/Box';
import { Headline } from '../../../../components/headline/Headline';
import { Text } from '../../../../components/text/Text';
import { BookingEventUiInterface } from '../../../../globalState/interfaces/BookingsInterface';
import { BookingsStatus } from '../../../../utils/consultant';
import { BookingEventTableColumnAttendee } from '../BookingEventTableColumnAttendee/bookingEventTableColumnAttendee';
import { DownloadICSFile } from '../../../../components/downloadICSFile/downloadICSFile';
import { BookingDescription } from '../BookingDescription/bookingDescription';
import { ReactComponent as CalendarRescheduleIcon } from '../../../../resources/img/icons/calendar-reschedule.svg';
import { ReactComponent as CalendarCancelIcon } from '../../../../resources/img/icons/calendar-cancel.svg';
import { LocationType } from './LocationType';

interface EventProps {
	event: BookingEventUiInterface;
	bookingStatus: BookingsStatus;
}

export const Event: React.FC<EventProps> = ({ event, bookingStatus }) => {
	const { t: translate } = useTranslation();
	const navigate = useNavigate();

	const handleCancellationAppointment = (event: BookingEventUiInterface) => {
		navigate('/booking/cancellation', { state: { uid: event.uid } });
	};

	const handleRescheduleAppointment = (event: BookingEventUiInterface) => {
		navigate('/booking/reschedule', {
			state: {
				rescheduleLink: event.rescheduleLink,
				bookingId: event.id,
				askerId: event.askerId
			}
		});
	};

	const activeBookings = bookingStatus === BookingsStatus.ACTIVE;

	return (
		<Box key={event.id}>
			<div
				className={`bookingEvents__innerWrapper-event ${
					bookingStatus !== BookingsStatus.ACTIVE
						? 'bookingEvents__innerWrapper-no-actions'
						: ''
				}`}
			>
				<div className="bookingEvents__basicInformation">
					<div className="bookingEvents__group">
						<Headline
							text={event.date}
							semanticLevel="4"
							className="bookingEvents__date"
						></Headline>
						<Headline
							text={event.duration}
							semanticLevel="5"
							className="bookingEvents__duration"
						></Headline>
					</div>
					<div className="bookingEvents__group bookingEvents__counselorWrap">
						<BookingEventTableColumnAttendee event={event} />
						<LocationType event={event} />
					</div>
				</div>
				<BookingDescription description={event.description} />
				<div className="bookingEvents__actions">
					{activeBookings && (
						<div className="bookingEvents__ics--mobile bookingEvents--flex bookingEvents--pointer">
							<DownloadICSFile
								start={event.startTime}
								end={event.endTime}
								title={event.title}
								description={event.description}
								uid={event.uid}
							/>
						</div>
					)}
					{activeBookings && (
						<div className="bookingEvents--flex">
							<div
								className="bookingEvents--flex bookingEvents--align-items-center bookingEvents--pointer bookingEvents__reschedule"
								onClick={handleRescheduleAppointment.bind(
									this,
									event
								)}
							>
								<CalendarRescheduleIcon />
								<Text
									type="standard"
									text={translate(
										'booking.event.booking.reschedule'
									)}
									className="bookingEvents--primary"
								/>
							</div>
							<div
								className="bookingEvents--flex bookingEvents--align-items-center bookingEvents--pointer bookingEvents__cancel"
								onClick={handleCancellationAppointment.bind(
									this,
									event
								)}
							>
								<CalendarCancelIcon />
								<Text
									type="standard"
									text={translate(
										'booking.event.booking.cancel'
									)}
									className="bookingEvents--primary"
								/>
							</div>
						</div>
					)}
					{event.videoAppointmentId && (
						<Text
							type="standard"
							text={translate(
								'legacyVideoAppointment.unavailable.message'
							)}
							className="bookingEvents--tertiary"
						/>
					)}
				</div>
			</div>
			<div className="bookingEvents__video-link-grid">
				{activeBookings && (
					<div className="bookingEvents__ics bookingEvents--flex bookingEvents--pointer">
						<DownloadICSFile
							start={event.startTime}
							end={event.endTime}
							title={event.title}
							description={event.description}
							uid={event.uid}
						/>
					</div>
				)}
			</div>
		</Box>
	);
};
