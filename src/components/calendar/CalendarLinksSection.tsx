/**
 * *19 (Frank, 2026-11-17): "Links ohne Termin" in the calendar list. The
 * former "Meine Direktlinks" page lives here now: copy, QR code, edit.
 */
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { MyDirectLinksPanel } from '../directLinks/MyDirectLinksPanel';
import { useDirectLinksAllowed } from '../directLinks/useDirectLinksAllowed';

/** The box under the list; `children` is the titled list of links. */
export const CalendarLinksBox = ({
	children
}: {
	children: React.ReactNode;
}) => (
	<div className="calendarPage__links" data-cy="calendar-links">
		{children}
	</div>
);

/** Title and line for the links list, as the calendar names it. */
export const useCalendarLinksLabels = () => {
	const { t } = useTranslation();
	return {
		title: t('calendar.links.title'),
		description: t('calendar.links.hint')
	};
};

/** The counsellor's own links, hidden while no medium is allowed. */
export const CalendarLinksSection = () => {
	const labels = useCalendarLinksLabels();
	return useDirectLinksAllowed(true) ? (
		<CalendarLinksBox>
			<MyDirectLinksPanel {...labels} />
		</CalendarLinksBox>
	) : null;
};
