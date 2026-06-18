import * as React from 'react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { mobileListView } from '../app/navigationHandler';
import './session.styles';

export const SessionViewEmpty = () => {
	const { t: translate } = useTranslation();
	useEffect(() => {
		mobileListView();
	}, []);
	return (
		<div className="session session--empty">
			<div className="session__emptyState" aria-live="polite">
				<div className="session__emptyStateMark" aria-hidden="true" />
				<p className="session__emptyStateText">
					{translate('session.empty')}
				</p>
			</div>
		</div>
	);
};
