import React from 'react';
import { BookingEvent } from '../../../../containers/overview/components/BookingEvent';
import {
	EmptyState,
	EmptyType
} from '../../../../containers/overview/components/EmptyState';
import { useUpcomingAppointments } from '../../../../containers/overview/hooks/useUpcomingAppointments';

export const OverviewBookings = () => {
	const { appointments } = useUpcomingAppointments();

	if (appointments.length === 0) {
		return (
			<EmptyState
				type={EmptyType.Termine}
				className="overviewEmptyState__profilePage"
			/>
		);
	}
	return (
		<div className="bookings">
			{appointments.map((appointment) => (
				<BookingEvent appointment={appointment} key={appointment.id} />
			))}
		</div>
	);
};
