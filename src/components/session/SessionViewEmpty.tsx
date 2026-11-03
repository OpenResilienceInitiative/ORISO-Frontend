import * as React from 'react';
import { useContext, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
	AUTHORITIES,
	hasUserAuthority,
	SessionTypeContext,
	UserDataContext
} from '../../globalState';
import { mobileListView } from '../app/navigationHandler';
import { EmptyState } from '../emptyState/EmptyState';
import { useSessionListViewState } from '../sessionsList/SessionListViewStateContext';
import { SESSION_LIST_TYPES } from './sessionHelpers';
import { CounsellorDashboardWired } from '../counsellorDashboard/CounsellorDashboardWired';
import './session.styles';

export const SessionViewEmpty = () => {
	const { t: translate } = useTranslation();
	const { type } = useContext(SessionTypeContext);
	const { userData } = useContext(UserDataContext);
	const { getSessionListViewState } = useSessionListViewState();
	const { ready, visibleSessionCount } = getSessionListViewState(type);
	const showSelectMessage = ready && visibleSessionCount > 0;
	/* #1795: a counsellor's "Gespräche" shows her overview while nothing is
	   selected, once she has a direct link. Erstanfragen stays as it is. */
	const showDashboard =
		type === SESSION_LIST_TYPES.MY_SESSION &&
		Boolean(userData) &&
		hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData);

	useEffect(() => {
		mobileListView();
	}, []);

	const empty = (
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

	return showDashboard ? (
		<CounsellorDashboardWired fallback={empty} />
	) : (
		empty
	);
};
