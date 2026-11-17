import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyState, type EmptyStateVariant } from '../emptyState/EmptyState';

export const ActivityTimelineEmptyState = ({
	variant = 'conversation-nothing-to-do'
}: {
	/** The desktop split shows the cup on the right, so the list differs. */
	variant?: EmptyStateVariant;
}) => {
	const { t } = useTranslation();

	return (
		<EmptyState
			className="notificationsCenter__fullEmptyState"
			headline={t('notifications.center.empty')}
			variant={variant}
		/>
	);
};
