import * as React from 'react';
import { Text } from '../text/Text';
import { ReactComponent as CalendarICSIcon } from '../../resources/img/icons/calendar-ics.svg';
import './downloadICSFile.styles';
import { useTranslation } from 'react-i18next';
import { buildAppointmentIcs } from '../../utils/appointmentIcs';
import { downloadICSFile } from '../../utils/downloadICSFile';

export interface AppointmentInfoICS {
	/** Start as ISO-8601 string, epoch millis or Date. */
	start: string | number | Date;
	/** End of the appointment; alternative to `durationMinutes`. */
	end?: string | number | Date;
	/** Length in minutes; alternative to `end`. */
	durationMinutes?: number;
	title: string;
	description?: string;
	location?: string;
	/** Stable id (e.g. the booking uid) so re-exports update the same event. */
	uid?: string;
}

const handleICSAppointment = (appointmentInfo: AppointmentInfoICS) => {
	try {
		const ics = buildAppointmentIcs(appointmentInfo);
		downloadICSFile(appointmentInfo.title || 'appointment', ics);
	} catch (error) {
		// Never let a malformed appointment crash the surrounding message/list.
		// eslint-disable-next-line no-console
		console.error('Could not create calendar file', error);
	}
};

export const DownloadICSFile = (params: AppointmentInfoICS) => {
	const { t: translate } = useTranslation();
	return (
		<div
			className="downloadICSFile--flex"
			onClick={() => handleICSAppointment(params)}
		>
			<CalendarICSIcon className="downloadICSFile__icon" />
			<Text
				type="standard"
				text={translate('message.appointmentSet.addToCalendar')}
				className="downloadICSFile__text downloadICSFile--primary"
			/>
		</div>
	);
};
