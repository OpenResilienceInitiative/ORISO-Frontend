import React from 'react';
import { useUpcomingAppointments } from '../../hooks/useUpcomingAppointments';
import { BookingEvent } from '../BookingEvent';
import { EmptyType } from '../EmptyState';
import { OverviewCard } from '../OverviewCard/OverviewCard';

export const BookingCard = () => {
	const { appointments, isLoading } = useUpcomingAppointments();

	return (
		<OverviewCard
			allMessagesPaths="/booking/events"
			className="bookingCard"
			title="overview.upcomingAppointments"
			dataListLength={appointments.length}
			emptyType={EmptyType.Termine}
			isLoading={isLoading}
		>
			{!isLoading &&
				appointments.map((appointment) => (
					<BookingEvent
						key={appointment.id}
						appointment={appointment}
					/>
				))}
		</OverviewCard>
	);
};
