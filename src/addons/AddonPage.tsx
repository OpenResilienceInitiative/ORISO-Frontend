import * as React from 'react';
import { useContext } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
	AUTHORITIES,
	hasUserAuthority,
	LocaleContext,
	UserDataContext
} from '../globalState';
import { AddonSlot } from './addonTypes';
import { AddonPlacement } from './useAddonHostProps';
import { appTitle, findAddonApp, useAddonRegistry } from './addonRegistry';
import { AddonMount } from './AddonMount';
import './addons.styles';

/** Own page of an add-on app, reached from the navigation (`asker.navigation` / `consultant.navigation`). */
export const AddonPage = () => {
	const { addonName, appId } = useParams();
	const { t: translate } = useTranslation();
	const userData = useContext(UserDataContext)?.userData;
	const locale = useContext(LocaleContext)?.locale ?? 'de';
	const { addons, loaded } = useAddonRegistry();

	const slot: AddonSlot = hasUserAuthority(
		AUTHORITIES.CONSULTANT_DEFAULT,
		userData
	)
		? 'consultant.navigation'
		: 'asker.navigation';
	const found = findAddonApp(addons, addonName, appId);
	const agencies = userData?.agencies ?? [];
	// With several agencies there is no single one to choose; the AddonService then uses all of them.
	const placement: AddonPlacement =
		slot === 'consultant.navigation' && agencies.length === 1
			? { agencyId: agencies[0].id }
			: {};

	if (!loaded) {
		return null;
	}
	if (!found || !found.app.slots.includes(slot)) {
		return (
			<div className="addonPage">
				<p>{translate('addons.notAvailable')}</p>
			</div>
		);
	}
	return (
		<div className="addonPage">
			<h1 className="addonPage__title">{appTitle(found.app, locale)}</h1>
			<AddonMount
				addon={found.addon}
				app={found.app}
				slot={slot}
				placement={placement}
			/>
		</div>
	);
};
