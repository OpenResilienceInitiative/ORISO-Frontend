import * as React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAppConfig } from '../../../../hooks/useAppConfig';

export const BookingCancellation = () => {
	const settings = useAppConfig();

	const location = useLocation();
	const state = location.state as { uid?: string } | null;

	// Guard against a direct visit with no router state (would crash below).
	if (!state?.uid) {
		return <Navigate to="/booking/events" replace />;
	}

	return (
		(settings.calcomUrl && (
			<iframe
				src={`${settings.calcomUrl}/cancel/${state.uid}`}
				frameBorder={0}
				scrolling="false"
				width="100%"
				height="100%"
				title="booking-cancellation"
			/>
		)) ||
		null
	);
};
