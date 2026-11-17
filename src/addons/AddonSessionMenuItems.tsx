import * as React from 'react';
import { useContext } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
	ActiveSessionContext,
	AUTHORITIES,
	hasUserAuthority,
	LocaleContext,
	UserDataContext
} from '../globalState';
import { ChatMenuDropdownItemContent } from '../components/chatMenuDropdown/ChatMenuDropdown';
import { appTitle, useCaseAddonApps } from './addonRegistry';
import { localizedText } from './addonLink';
import { AddonBadge } from './AddonBadge';
import { AddonIcon } from './AddonIcon';
import { addonActionId, withAddonPanel } from './addonPanel';
import './addons.styles';

interface AddonSessionMenuItemsProps {
	/** Closes the menu before the app opens beside the chat. */
	onSelect: () => void;
}

/**
 * Entries of add-on apps in a chat's menu (`asker.session-menu`, `consultant.session-menu`);
 * each opens its app in the side panel beside the chat.
 */
export const AddonSessionMenuItems = ({
	onSelect
}: AddonSessionMenuItemsProps) => {
	const activeSession = useContext(ActiveSessionContext)?.activeSession;
	const userData = useContext(UserDataContext)?.userData;
	const locale = useContext(LocaleContext)?.locale ?? 'de';
	const location = useLocation();
	const navigate = useNavigate();
	const slot = hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData)
		? 'consultant.session-menu'
		: 'asker.session-menu';
	const apps = useCaseAddonApps(slot, {
		agencyId: activeSession?.item?.agencyId,
		sessionId: activeSession?.item?.id
	});

	return (
		<>
			{apps.map(({ addon, app }) => {
				const title = appTitle(app, locale);
				return (
					<button
						key={`${addon.name}/${app.id}`}
						type="button"
						className="sessionMenu__item chatMenuDropdown__item"
						data-addon-action={addonActionId(addon.name, app.id)}
						data-addon-menu-entry=""
						data-cy="session-menu-addon"
						onClick={() => {
							onSelect();
							navigate({
								pathname: location.pathname,
								search: withAddonPanel(location.search, {
									addonName: addon.name,
									appId: app.id
								})
							});
						}}
					>
						<ChatMenuDropdownItemContent
							icon={
								<AddonIcon
									icon={app.icon}
									className="addonMenuEntry__icon"
								/>
							}
							title={
								<>
									{title}
									<AddonBadge badge={app.badge} />
								</>
							}
							description={localizedText(app.description, locale)}
						/>
					</button>
				);
			})}
		</>
	);
};
