import * as React from 'react';
import { useTranslation } from 'react-i18next';
import '../booking.styles.scss';
import { useAppConfig } from '../../../../hooks/useAppConfig';

export const AssignedCalendars = () => {
	const { t } = useTranslation();
	const settings = useAppConfig();

	if (!settings.calcomUrl) {
		return null;
	}

	return (
		<div className="assignedCalendars__wrapper">
			<iframe
				title={t('booking.assignedCalendars.iframeTitle')}
				src={`${settings.calcomUrl}/apps/installed`}
				frameBorder={0}
				width="100%"
				height="75%"
				style={{ paddingRight: '20px' }}
			/>
		</div>
	);
};
