import * as React from 'react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ListInfo } from '../listInfo/ListInfo';
import { ReactComponent as NoMessagesIllustration } from '../../resources/img/illustrations/no-messages.svg';
import {
	SESSION_LIST_TAB_ARCHIVE,
	SESSION_LIST_TYPES
} from '../session/sessionHelpers';

interface EmptyListItemProps {
	type: SESSION_LIST_TYPES;
	sessionListTab: string;
}

export const EmptyListItem = ({ type, sessionListTab }: EmptyListItemProps) => {
	const { t } = useTranslation();

	const emptyTitle = useMemo(() => {
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
	}, [sessionListTab, type, t]);
	return (
		<ListInfo headline={emptyTitle} Illustration={NoMessagesIllustration} />
	);
};
