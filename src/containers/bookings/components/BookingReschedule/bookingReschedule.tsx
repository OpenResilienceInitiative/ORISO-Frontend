import * as React from 'react';
import { useContext } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import {
	AUTHORITIES,
	hasUserAuthority,
	UserDataContext
} from '../../../../globalState';
import { useAppConfig } from '../../../../hooks/useAppConfig';

export const BookingReschedule = () => {
	const { userData } = useContext(UserDataContext);
	const isConsultant = hasUserAuthority(
		AUTHORITIES.CONSULTANT_DEFAULT,
		userData
	);
	const settings = useAppConfig();

	const location = useLocation();
	const state = location.state as {
		askerId?: string;
		rescheduleLink?: string;
		bookingId?: string;
	} | null;

	// Direct navigation (or partial state) would crash on state.* below — every
	// field the iframe URL needs must be present, else bail to the overview.
	if (
		!state?.rescheduleLink ||
		!state?.bookingId ||
		(isConsultant && !state?.askerId)
	) {
		return <Navigate to="/booking/events" replace />;
	}

	const userId = isConsultant ? state.askerId : userData.userId;

	return (
		(settings.calcomUrl && (
			<iframe
				src={`${settings.calcomUrl}${state.rescheduleLink}&metadata[bookingId]=${state.bookingId}&metadata[user]=${userId}`}
				frameBorder={0}
				scrolling="false"
				width="100%"
				height="100%"
				title="booking-reschedule"
			/>
		)) ||
		null
	);
};
