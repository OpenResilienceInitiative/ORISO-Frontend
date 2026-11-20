import * as React from 'react';
import clsx from 'clsx';
import './upcomingAppointmentClock.styles.scss';
import { AppointmentKindGlyph } from '../sessionsList/timeline/AppointmentKindGlyph';
import type { EntryModality } from '../sessionsList/timeline/timelineModel';

/**
 * Grey calendar circle on a conversation card too narrow for its appointment
 * row (ADR-021). Not a control of its own: a click lands on the card and opens
 * the room, so the card gains no second interactive element.
 */
export const UpcomingAppointmentClock = ({
	label,
	modality,
	overlay = false
}: {
	/** e.g. "Nächster Termin: Mo 13. Dez 18:00" — names the date, not only "clock". */
	label: string;
	/** What kind of appointment it is; a plain calendar while unknown. */
	modality?: EntryModality;
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
		<AppointmentKindGlyph modality={modality} />
	</span>
);
