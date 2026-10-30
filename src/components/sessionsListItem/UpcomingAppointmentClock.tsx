import * as React from 'react';
import clsx from 'clsx';
import './upcomingAppointmentClock.styles.scss';
import { ReactComponent as ClockIcon } from '../../resources/img/icons/timeline-schedule.svg';

/**
 * Grey clock circle on a conversation card that has an upcoming appointment
 * (ADR-021). Not a control of its own: a click lands on the card and opens
 * the room, so the card gains no second interactive element.
 */
export const UpcomingAppointmentClock = ({
	label,
	overlay = false
}: {
	/** e.g. "Nächster Termin: Mo 13. Dez 18:00" — names the date, not only "clock". */
	label: string;
	/** On a single avatar it sits small at its corner; in a stack it is a full member. */
	overlay?: boolean;
}) => (
	<span
		className={clsx(
			'upcomingAppointmentClock',
			overlay && 'upcomingAppointmentClock--overlay'
		)}
		role="img"
		aria-label={label}
		title={label}
		data-cy="upcoming-appointment-clock"
	>
		<ClockIcon aria-hidden="true" focusable="false" />
	</span>
);
