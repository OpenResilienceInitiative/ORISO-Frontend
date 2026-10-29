import * as React from 'react';
import './sessionsListItem.styles';

export const SessionsListSkeleton = () => {
	return (
		// A loading placeholder, not a row: hidden from assistive tech and out of
		// the tab order, so the list holds only real items (#1338).
		<div className="sessionsListItem skeleton" aria-hidden="true">
			<div className="sessionsListItem__content">
				<div className="sessionsListItem__row">
					<div className="sessionsListItem__consultingType skeleton__item"></div>
				</div>
				<div className="sessionsListItem__row">
					<div className="sessionsListItem__icon skeleton__item"></div>
					<div className="sessionsListItem__username skeleton__item"></div>
				</div>
				<div className="sessionsListItem__row">
					<div className="sessionsListItem__subject skeleton__item"></div>
					<div className="sessionsListItem__date skeleton__item"></div>
				</div>
			</div>
		</div>
	);
};
