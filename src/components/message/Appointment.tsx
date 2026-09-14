import * as React from 'react';
import { Text } from '../text/Text';
import { Headline } from '../headline/Headline';
import './appointment.styles';
import { ReactComponent as CalendarCheckIcon } from '../../resources/img/icons/calendar-check.svg';
import { ReactComponent as CalendarCancelIcon } from '../../resources/img/icons/calendar-cancel.svg';
import { formatToHHMM } from '../../utils/dateHelpers';
import { DownloadICSFile } from '../downloadICSFile/downloadICSFile';
import { ALIAS_MESSAGE_TYPES } from '../../api/apiSendAliasMessage';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { parseAppointmentData } from './appointmentData';

interface AppointmentPresentation {
	headerKey: string;
	titleKey: string;
	icon: 'check' | 'cancel';
	showCalendarAction: boolean;
}

const appointmentPresentations: Partial<
	Record<ALIAS_MESSAGE_TYPES, AppointmentPresentation>
> = {
	[ALIAS_MESSAGE_TYPES.APPOINTMENT_SET]: {
		headerKey: 'message.appointment.component.header.confirmation',
		titleKey: 'message.appointmentSet.title',
		icon: 'check',
		showCalendarAction: true
	},
	[ALIAS_MESSAGE_TYPES.INITIAL_APPOINTMENT_DEFINED]: {
		headerKey: 'message.appointment.component.header.confirmation',
		titleKey: 'message.appointmentSet.title',
		icon: 'check',
		showCalendarAction: true
	},
	[ALIAS_MESSAGE_TYPES.APPOINTMENT_RESCHEDULED]: {
		headerKey: 'message.appointment.component.header.change',
		titleKey: 'message.appointmentRescheduled.title',
		icon: 'check',
		showCalendarAction: true
	},
	[ALIAS_MESSAGE_TYPES.APPOINTMENT_CANCELLED]: {
		headerKey: 'message.appointment.component.header.cancellation',
		titleKey: 'message.appointmentCancelled.title',
		icon: 'cancel',
		showCalendarAction: false
	}
};

export const Appointment = (param: {
	data: string;
	messageType: ALIAS_MESSAGE_TYPES;
}) => {
	const { t: translate } = useTranslation();
	const [expanded, setExpanded] = useState(false);
	const parsedData = parseAppointmentData(param.data);
	const presentation = appointmentPresentations[param.messageType];

	if (!parsedData || !presentation) {
		return null;
	}

	const duration = parsedData.duration;
	const startingTimeStampDate = new Date(parsedData.date).getTime();
	const finishingHour = startingTimeStampDate + duration * 60 * 1000;
	const appointmentDate = new Date(startingTimeStampDate).toLocaleDateString(
		'de-de',
		{
			weekday: 'long',
			year: '2-digit',
			month: '2-digit',
			day: '2-digit'
		}
	);

	const translateKey = expanded
		? 'booking.event.show.less'
		: 'booking.event.show.more';

	const appointmentHours = `${formatToHHMM(
		`${startingTimeStampDate}`
	)} - ${formatToHHMM(`${finishingHour}`)}`;

	const appointmentTitle = translate(presentation.titleKey);
	const appointmentIcon =
		presentation.icon === 'check' ? (
			<CalendarCheckIcon />
		) : (
			<CalendarCancelIcon />
		);
	const appointmentComponentHeader = translate(presentation.headerKey);

	return (
		<React.Fragment>
			<Text
				type="infoSmall"
				text={appointmentComponentHeader}
				className="appointmentSet__confirmation appointmentSet--primary"
			/>
			<div className="appointmentSet">
				<div className="appointmentSet--flex">
					<span className="appointmentSet__titleIcon">
						{appointmentIcon}
					</span>
					<Headline
						semanticLevel="5"
						text={appointmentTitle}
						className="appointmentSet__title"
					/>
				</div>
				<div className="appointmentSet--flex">
					<Text
						type="standard"
						text={appointmentDate}
						className="appointmentSet__date"
					/>
					<Text
						type="standard"
						text={appointmentHours}
						className="appointmentSet__time"
					/>
				</div>
				{parsedData.title && (
					<Text
						type="standard"
						className="appointmentSet__summary"
						text={parsedData.title}
					/>
				)}
				{parsedData.note && (
					<div
						className={`appointmentSet__note__description ${
							expanded ? 'expanded' : 'shrinked'
						}`}
					>
						<Text
							type="standard"
							className="appointmentSet__note__title"
							text={translate('message.note.title')}
						/>
						<Text
							type="standard"
							className="appointmentSet__note__descriptionText"
							text={parsedData.note}
						/>
						{parsedData.note.length > 110 && (
							<>
								<div
									className="appointmentSet__note appointmentSet--flex appointmentSet--pointer"
									onClick={() => setExpanded(!expanded)}
								>
									<Text
										text={translate(translateKey)}
										type="standard"
										className="appointmentSet__note__showMore bookingEvents--pointer bookingEvents--primary"
									/>
								</div>
							</>
						)}
					</div>
				)}
				{presentation.showCalendarAction && (
					<DownloadICSFile
						start={parsedData.date}
						durationMinutes={duration}
						title={parsedData.title}
						description={parsedData.note}
						location={parsedData.location}
					/>
				)}
			</div>
		</React.Fragment>
	);
};
