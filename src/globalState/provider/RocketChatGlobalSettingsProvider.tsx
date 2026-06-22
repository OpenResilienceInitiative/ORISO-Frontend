import * as React from 'react';
import { createContext, useCallback, useEffect, useState } from 'react';
import {
	apiRocketChatSettingsPublic,
	SETTING_E2E_ENABLE,
	SETTING_FILEUPLOAD_MAXFILESIZE,
	SETTING_HIDE_SYSTEM_MESSAGES,
	SETTING_MESSAGE_ALLOWDELETING,
	SETTING_MESSAGE_MAXALLOWEDSIZE,
	SETTING_MESSAGE_SHOWDELETEDSTATUS,
	TSetting
} from '../../api/apiRocketChatSettingsPublic';
import { getFallbackPublicSettings } from '../../api/apiMatrixSettingsPublic';

const SETTINGS_TO_FETCH = [
	SETTING_E2E_ENABLE,
	SETTING_MESSAGE_MAXALLOWEDSIZE,
	SETTING_FILEUPLOAD_MAXFILESIZE,
	SETTING_MESSAGE_ALLOWDELETING,
	SETTING_MESSAGE_SHOWDELETEDSTATUS,
	SETTING_HIDE_SYSTEM_MESSAGES
];

type RocketChatGlobalSettingsContextProps = {
	settings: TSetting[];
	settingsReady: boolean;
	getSetting: <T extends TSetting>(id: T['_id']) => T | null;
};

export const RocketChatGlobalSettingsContext =
	createContext<RocketChatGlobalSettingsContextProps>(null);

export const RocketChatGlobalSettingsProvider = (props) => {
	const [settings, setSettings] = useState<TSetting[]>([]);
	const [settingsReady, setSettingsReady] = useState(false);

	useEffect(() => {
		let cancelled = false;

		apiRocketChatSettingsPublic(SETTINGS_TO_FETCH)
			.then((res) => {
				if (!cancelled) {
					setSettings(res.settings);
				}
			})
			.catch((error) => {
				console.error('Failed to load public settings:', error);
				if (!cancelled) {
					setSettings(getFallbackPublicSettings(SETTINGS_TO_FETCH));
				}
			})
			.finally(() => {
				if (!cancelled) {
					setSettingsReady(true);
				}
			});

		return () => {
			cancelled = true;
		};
	}, []);

	const getSetting = useCallback(
		<T extends TSetting>(id: T['_id']): T | null => {
			return (settings.find((s) => s._id === id) as T) ?? null;
		},
		[settings]
	);

	return (
		<RocketChatGlobalSettingsContext.Provider
			value={{ settings, settingsReady, getSetting }}
		>
			{props.children}
		</RocketChatGlobalSettingsContext.Provider>
	);
};
