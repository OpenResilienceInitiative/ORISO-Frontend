import * as React from 'react';
import { useContext } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LocaleContext } from '../globalState';
import { ReactComponent as ToolsIcon } from '../resources/img/icons/tools_outline.svg';
import { appTitle, useAddonApps } from './addonRegistry';
import { parseAddonPanel, withAddonPanel } from './addonPanel';
import './addons.styles';

/** Buttons in the case view header that open the counsellor's add-on apps as side panel. */
export const AddonSessionActions = () => {
	const apps = useAddonApps('consultant.session');
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
				return (
					<button
						key={`${addon.name}/${app.id}`}
						type="button"
						className="addonActions__button"
						aria-pressed={active}
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
						<span>{appTitle(app, locale)}</span>
					</button>
				);
			})}
		</div>
	);
};
