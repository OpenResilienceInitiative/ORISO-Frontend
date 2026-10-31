/**
 * Twin of an appointment whose room the list does not know (ADR-021): a 1:1
 * booking carries no session id until the appointment service stores one.
 * Same card frame and body as a room card; the split button sits in the
 * preview's place and its main part opens the menu, there is no room to open.
 */
import * as React from 'react';
import clsx from 'clsx';
import { SessionCardBody } from '../../sessionsListItem/SessionCardBody/SessionCardBody';
import { UpcomingAppointmentClock } from '../../sessionsListItem/UpcomingAppointmentClock';
import {
	AppointmentSplitButton,
	type AppointmentAction
} from './AppointmentSplitButton';
import type { TwinCardFlags } from './FutureZone';
import type { FutureEntry, TimelineRole } from './timelineModel';

export const UnmappedAppointmentCard = ({
	entry,
	role,
	flags,
	onAction
}: {
	entry: FutureEntry;
	role: TimelineRole;
	flags: TwinCardFlags;
	onAction?: AppointmentAction;
}) => (
	<div
		className={clsx(
			'sessionsListItem',
			'sessionsListItem--read',
			'sessionsListItem--grouped',
			flags.isGroupStart && 'sessionsListItem--groupStart',
			flags.isGroupEnd && 'sessionsListItem--groupEnd',
			flags.isBeforeActive && 'sessionsListItem--beforeActive',
			flags.isAfterActive && 'sessionsListItem--afterActive'
		)}
		data-cy="timeline-unmapped-card"
	>
		<div
			className="sessionsListItem__content sessionsListItem__content--flow"
			role="listitem"
		>
			<SessionCardBody
				name={
					<div className="sessionsListItem__username sessionsListItem__username--readLabel">
						{entry.title}
					</div>
				}
				avatar={
					<div className="sessionsListItem__icon">
						<UpcomingAppointmentClock label={entry.title} />
					</div>
				}
				action={
					<AppointmentSplitButton
						entry={entry}
						role={role}
						active={false}
						onAction={onAction}
					/>
				}
			/>
		</div>
	</div>
);
