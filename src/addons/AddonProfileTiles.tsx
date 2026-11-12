import * as React from 'react';
import { useContext, useEffect, useState } from 'react';
import { ActiveSessionContext, LocaleContext } from '../globalState';
import { apiGetUserDataBySessionId } from '../api/apiGetUserDataBySessionId';
import { Box } from '../components/box/Box';
import { appTitle, useCaseAddonApps } from './addonRegistry';
import { AddonBadge } from './AddonBadge';
import { AddonMount } from './AddonMount';
import './addons.styles';

/** Tiles of add-on apps in the client profile counsellors see (`consultant.asker-profile`). */
export const AddonProfileTiles = () => {
	const activeSession = useContext(ActiveSessionContext)?.activeSession;
	const locale = useContext(LocaleContext)?.locale ?? 'de';
	const sessionId = activeSession?.item?.id;
	const agencyId = activeSession?.item?.agencyId;
	const apps = useCaseAddonApps('consultant.asker-profile', {
		agencyId,
		sessionId
	});
	const [askerId, setAskerId] = useState<string>();

	useEffect(() => {
		if (!sessionId || apps.length === 0) {
			return undefined;
		}
		let cancelled = false;
		apiGetUserDataBySessionId(sessionId)
			.then((data) => {
				if (!cancelled) {
					setAskerId(data?.askerId);
				}
			})
			.catch(() => undefined);
		return () => {
			cancelled = true;
		};
	}, [sessionId, apps.length]);

	if (apps.length === 0 || !sessionId || !askerId) {
		return null;
	}
	return (
		<>
			{apps.map(({ addon, app }) => (
				<Box key={`${addon.name}/${app.id}`}>
					<div className="addonTile">
						<h2 className="addonTile__title">
							{appTitle(app, locale)}
							<AddonBadge badge={app.badge} />
						</h2>
						<AddonMount
							addon={addon}
							app={app}
							slot="consultant.asker-profile"
							placement={{ agencyId, sessionId, askerId }}
						/>
					</div>
				</Box>
			))}
		</>
	);
};
