import { apiServerSettings } from './apiServerSettings';
import type { ServerAppConfigInterface } from '../globalState/interfaces';
import type {
	IBooleanSetting,
	TSetting,
	TRocketChatSettingsPublicResponse
} from './apiRocketChatSettingsShared';
import {
	SETTING_E2E_ENABLE,
	SETTING_FILEUPLOAD_MAXFILESIZE,
	SETTING_HIDE_SYSTEM_MESSAGES,
	SETTING_MESSAGE_ALLOWDELETING,
	SETTING_MESSAGE_MAXALLOWEDSIZE,
	SETTING_MESSAGE_SHOWDELETEDSTATUS
} from './apiRocketChatSettingsShared';

const DEFAULT_SETTINGS: TSetting[] = [
	{
		_id: SETTING_E2E_ENABLE,
		enterprise: false,
		value: true
	},
	{
		_id: SETTING_MESSAGE_MAXALLOWEDSIZE,
		enterprise: false,
		value: 10000
	},
	{
		_id: SETTING_FILEUPLOAD_MAXFILESIZE,
		enterprise: false,
		value: 50000000
	},
	{
		_id: SETTING_MESSAGE_ALLOWDELETING,
		enterprise: false,
		value: true
	},
	{
		_id: SETTING_MESSAGE_SHOWDELETEDSTATUS,
		enterprise: false,
		value: true
	},
	{
		_id: SETTING_HIDE_SYSTEM_MESSAGES,
		enterprise: false,
		value: false
	}
] as TSetting[];

const SERVER_E2E_SETTING_KEYS = [
	'e2eEnabled',
	'enableE2eEncryption',
	'E2E_Enable'
];

const filterSettings = (
	settings: TSetting[],
	settingsEntries?: string[] | null
): TSetting[] => {
	if (!settingsEntries?.length) {
		return settings;
	}

	return settings.filter((setting) => settingsEntries.includes(setting._id));
};

const findE2eSetting = (settings: TSetting[] = []): IBooleanSetting | null =>
	(settings.find((setting) => setting._id === SETTING_E2E_ENABLE) as
		| IBooleanSetting
		| undefined) ?? null;

const readE2eFromServerSettings = (
	serverSettings: ServerAppConfigInterface
): boolean | null => {
	for (const key of SERVER_E2E_SETTING_KEYS) {
		const value = serverSettings?.[key]?.value;
		if (typeof value === 'boolean') {
			return value;
		}
	}

	return null;
};

const mapServerSettingsToPublicSettings = (
	serverSettings: ServerAppConfigInterface,
	settingsEntries?: string[] | null
): TSetting[] => {
	const settings: TSetting[] = [];
	const e2eValue = readE2eFromServerSettings(serverSettings);

	if (typeof e2eValue === 'boolean') {
		settings.push({
			_id: SETTING_E2E_ENABLE,
			enterprise: false,
			value: e2eValue
		});
	}

	return filterSettings(settings, settingsEntries);
};

const resolveE2eEnabled = (
	settings: TSetting[],
	serverSettings: ServerAppConfigInterface | null
): boolean => {
	const e2eSetting = findE2eSetting(settings);
	if (typeof e2eSetting?.value === 'boolean') {
		if (!e2eSetting.value) {
			throw new Error(
				`${SETTING_E2E_ENABLE} is disabled in backend settings`
			);
		}
		return e2eSetting.value;
	}

	if (serverSettings) {
		const serverE2e = readE2eFromServerSettings(serverSettings);
		if (typeof serverE2e === 'boolean') {
			if (!serverE2e) {
				throw new Error(
					`${SETTING_E2E_ENABLE} is disabled in backend settings`
				);
			}
			return serverE2e;
		}
	}

	// Matrix deployments may not expose RC-style public settings; secure default.
	return true;
};

const mergeSettings = (
	remoteSettings: TSetting[] | null,
	e2eEnabled: boolean
): TSetting[] => {
	const merged = new Map(
		DEFAULT_SETTINGS.map((setting) => [setting._id, setting])
	);

	remoteSettings?.forEach((setting) => {
		merged.set(setting._id, setting);
	});

	merged.set(SETTING_E2E_ENABLE, {
		_id: SETTING_E2E_ENABLE,
		enterprise: false,
		value: e2eEnabled
	});

	return Array.from(merged.values());
};

export const getFallbackPublicSettings = (
	settingsEntries?: string[] | null
): TSetting[] => filterSettings(DEFAULT_SETTINGS, settingsEntries);

export const apiMatrixSettingsPublic = async (
	settingsEntries: string[] | null = null
): Promise<TRocketChatSettingsPublicResponse> => {
	let serverSettings: ServerAppConfigInterface | null = null;
	let serviceSettings: TSetting[] | null = null;

	try {
		serverSettings = await apiServerSettings();
		serviceSettings = mapServerSettingsToPublicSettings(
			serverSettings,
			settingsEntries
		);
	} catch {
		// Fall through to defaults below.
	}

	const e2eEnabled = resolveE2eEnabled(serviceSettings ?? [], serverSettings);
	const settings = filterSettings(
		mergeSettings(serviceSettings, e2eEnabled),
		settingsEntries
	);

	return {
		count: settings.length,
		offset: 0,
		total: settings.length,
		success: true,
		settings
	};
};
