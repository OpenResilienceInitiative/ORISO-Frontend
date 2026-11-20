import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ToolsIcon } from '../resources/img/icons/tools_outline.svg';
import { normalizeTimelineLocale } from '../components/sessionsList/futureTimelineTime';
import { formatEntryRange } from '../components/sessionsList/timeline/timelineModel';
import { AddonCalendarEntry } from './addonCalendar';
import { addonLinkPath, localizedText } from './addonLink';
import { appTitle, findAddonApp, useAddonRegistry } from './addonRegistry';
import './addons.styles';

export interface AddonCalendarPillProps {
	entry: AddonCalendarEntry;
	now: Date;
	sessionsBasePath: string;
}

/** A read-only add-on date above "Jetzt": no menu, a click opens the add-on app. */
export const AddonCalendarPill = ({
	entry,
	now,
	sessionsBasePath
}: AddonCalendarPillProps) => {
	const { t, i18n } = useTranslation();
	const navigate = useNavigate();
	const { addons } = useAddonRegistry();
	const language = i18n.resolvedLanguage || i18n.language;
	const locale = normalizeTimelineLocale(
		i18n.resolvedLanguage,
		i18n.language
	);
	const found = findAddonApp(addons, entry.addon, entry.appId);
	const source = found ? appTitle(found.app, language) : entry.addon;
	const title = localizedText(entry.title, language) ?? '';
	const when = entry.allDay
		? `${new Intl.DateTimeFormat(locale, {
				weekday: 'short',
				day: 'numeric',
				month: 'short'
			}).format(entry.start)}, ${t('addons.calendar.allDay')}`
		: formatEntryRange(entry, now, locale);
	const kind = t(`addons.calendar.kind.${entry.kind}`);
	const sourceLabel = t('addons.calendar.source', { title: source });
	const path = addonLinkPath(entry.link, sessionsBasePath);

	return (
		<button
			type="button"
			className="tlp__entry addonCalendarEntry"
			data-cy="timeline-addon-entry"
			aria-disabled={path ? undefined : 'true'}
			aria-label={`${kind}: ${title}, ${when}. ${sourceLabel}`}
			title={sourceLabel}
			onClick={() => path && navigate(path)}
		>
			<ToolsIcon
				className="tlp__entryIcon"
				aria-hidden="true"
				focusable="false"
			/>
			<span className="tlp__entryText">
				<span className="tlp__entryTime">
					{entry.kind === 'appointment' ? when : `${kind}, ${when}`}
				</span>
				<span className="tlp__entryTitle">{title}</span>
			</span>
			<span className="addonCalendarEntry__source">{source}</span>
		</button>
	);
};
