import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '../emptyState/EmptyState';

export const ActivityTimelineEmptyState = () => {
	const { t } = useTranslation();

	return (
		<EmptyState
			className="notificationsCenter__fullEmptyState"
			headline={t('notifications.center.empty', 'No notifications yet.')}
			variant="conversation-nothing-to-do"
		/>
	);
};
