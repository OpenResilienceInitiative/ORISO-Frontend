/**
 * *19 (Frank, 2026-11-17): "Links ohne Termin" in the calendar list. The
 * former "Meine Direktlinks" page lives here now: copy, QR code, edit.
 */
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { MyDirectLinksPanel } from '../directLinks/MyDirectLinksPanel';
import { useDirectLinksAllowed } from '../directLinks/useDirectLinksAllowed';

/** The titled box under the list; `children` is the list of links. */
export const CalendarLinksBox = ({
	children
}: {
	children: React.ReactNode;
}) => {
	const { t } = useTranslation();
	return (
		<section
			className="calendarPage__links"
			aria-labelledby="calendar-links-title"
			data-cy="calendar-links"
		>
			<h2 className="calendarPage__linksTitle" id="calendar-links-title">
				{t('calendar.links.title')}
			</h2>
			<p className="calendarPage__linksHint">
				{t('calendar.links.hint')}
			</p>
			{children}
		</section>
	);
};

/** The counsellor's own links, hidden while no medium is allowed. */
export const CalendarLinksSection = () =>
	useDirectLinksAllowed(true) ? (
		<CalendarLinksBox>
			<MyDirectLinksPanel />
		</CalendarLinksBox>
	) : null;
