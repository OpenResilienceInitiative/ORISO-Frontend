import * as React from 'react';
import { useContext, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { SessionTypeContext } from '../../globalState';
import { mobileListView } from '../app/navigationHandler';
import { EmptyState } from '../emptyState/EmptyState';
import { useSessionListViewState } from '../sessionsList/SessionListViewStateContext';
import './session.styles';

export const SessionViewEmpty = () => {
	const { t: translate } = useTranslation();
	const { type } = useContext(SessionTypeContext);
	const { getSessionListViewState } = useSessionListViewState();
	const { ready, visibleSessionCount } = getSessionListViewState(type);
	const showSelectMessage = ready && visibleSessionCount > 0;

	useEffect(() => {
		mobileListView();
	}, []);

	return (
		<div className="session session--empty">
			<EmptyState
				className="session__emptyState"
				headline={translate(
					showSelectMessage
						? 'session.empty'
						: 'session.emptyAllCaughtUp'
				)}
				variant={
					showSelectMessage
						? 'conversation-history'
						: 'conversation-nothing-to-do'
				}
			/>
		</div>
	);
};
