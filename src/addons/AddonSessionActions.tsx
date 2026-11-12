import * as React from 'react';
import { useContext } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ActiveSessionContext, LocaleContext } from '../globalState';
import { ReactComponent as ToolsIcon } from '../resources/img/icons/tools_outline.svg';
import { appTitle, useCaseAddonApps } from './addonRegistry';
import { AddonBadge } from './AddonBadge';
import { parseAddonPanel, withAddonPanel } from './addonPanel';
import './addons.styles';

/** Buttons in the case view header that open the counsellor's add-on apps as side panel. */
export const AddonSessionActions = () => {
	const { t: translate } = useTranslation();
	const activeSession = useContext(ActiveSessionContext)?.activeSession;
	const apps = useCaseAddonApps('consultant.session', {
		agencyId: activeSession?.item?.agencyId,
		sessionId: activeSession?.item?.id
	});
	const location = useLocation();
	const navigate = useNavigate();
	const locale = useContext(LocaleContext)?.locale ?? 'de';
	const open = parseAddonPanel(location.search);

	if (apps.length === 0) {
		return null;
	}
	return (
		<div className="addonActions">
			{apps.map(({ addon, app }) => {
				const active =
					open?.addonName === addon.name && open?.appId === app.id;
				const title = appTitle(app, locale);
				return (
					<button
						key={`${addon.name}/${app.id}`}
						type="button"
						className="addonActions__button"
						aria-pressed={active}
						aria-label={
							app.badge && app.badge > 0
								? `${title}, ${translate('addons.badge', { count: app.badge })}`
								: undefined
						}
						onClick={() =>
							navigate({
								pathname: location.pathname,
								search: withAddonPanel(
									location.search,
									active
										? null
										: {
												addonName: addon.name,
												appId: app.id
											}
								)
							})
						}
					>
						<ToolsIcon aria-hidden="true" />
						<span>{title}</span>
						<AddonBadge badge={app.badge} decorative />
					</button>
				);
			})}
		</div>
	);
};
