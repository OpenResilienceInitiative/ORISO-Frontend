import * as React from 'react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyState, EmptyStateVariant } from '../emptyState/EmptyState';
import {
	SESSION_LIST_TAB_ARCHIVE,
	SESSION_LIST_TYPES
} from '../session/sessionHelpers';

interface EmptyListItemProps {
	type: SESSION_LIST_TYPES;
	sessionListTab: string;
	headlineOverride?: string;
}

export const EmptyListItem = ({
	type,
	sessionListTab,
	headlineOverride
}: EmptyListItemProps) => {
	const { t } = useTranslation();

	const emptyTitle = useMemo(() => {
		if (headlineOverride) {
			return headlineOverride;
		}
		if (sessionListTab === SESSION_LIST_TAB_ARCHIVE) {
			return t('sessionList.empty.archived');
		}

		switch (type) {
			case SESSION_LIST_TYPES.ENQUIRY:
				return t('sessionList.empty.known');
			case SESSION_LIST_TYPES.MY_SESSION:
			default:
				return t('sessionList.empty.mySessions');
		}
	}, [headlineOverride, sessionListTab, type, t]);

	const emptyStateVariant = useMemo<EmptyStateVariant>(() => {
		if (sessionListTab === SESSION_LIST_TAB_ARCHIVE) {
			return 'archive';
		}

		if (type === SESSION_LIST_TYPES.ENQUIRY) {
			return 'inquiry';
		}

		return 'no-conversations';
	}, [sessionListTab, type]);

	return (
		<EmptyState
			className="sessionsList__emptyState"
			headline={emptyTitle}
			variant={emptyStateVariant}
		/>
	);
};
