import * as React from 'react';
import { useTranslation } from 'react-i18next';

export const LegacyVideoAppointmentUnavailable = () => {
	const { t } = useTranslation();

	return (
		<main data-testid="legacy-video-appointment-unavailable">
			<h1>{t('legacyVideoAppointment.unavailable.message')}</h1>
		</main>
	);
};

export const legacyVideoAppointmentRoutes = [
	'/videoberatung/:type/:appointmentId',
	'/consultant/videoberatung/:type/:appointmentId'
].map((path) => ({ path, element: <LegacyVideoAppointmentUnavailable /> }));
