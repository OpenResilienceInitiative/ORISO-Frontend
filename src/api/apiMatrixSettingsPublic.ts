import { endpoints } from '../resources/scripts/endpoints';
import { apiServerSettings } from './apiServerSettings';
import { fetchData, FETCH_ERRORS, FETCH_METHODS } from './fetchData';
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

const readServerE2eSetting = async (): Promise<boolean | null> => {
	const serverSettings = await apiServerSettings();

	for (const key of SERVER_E2E_SETTING_KEYS) {
		const value = serverSettings?.[key]?.value;
		if (typeof value === 'boolean') {
			return value;
		}
	}

	return null;
};

const fetchRocketChatPublicSettings = async (
	settingsEntries?: string[] | null
): Promise<TSetting[] | null> => {
	const query = settingsEntries?.length
		? `?query=${encodeURIComponent(
				JSON.stringify({ _id: { $in: settingsEntries } })
			)}`
		: '';

	try {
		const response = await fetchData({
			url: `${endpoints.rc.settings.public}${query}`,
			method: FETCH_METHODS.GET,
			skipAuth: true,
			responseHandling: [FETCH_ERRORS.CATCH_ALL]
		});

		if (response?.success && Array.isArray(response.settings)) {
			return response.settings;
		}
	} catch {
		// Fall through to service settings / defaults below.
	}

	return null;
};

const resolveE2eEnabled = async (settings: TSetting[]): Promise<boolean> => {
	const e2eSetting = findE2eSetting(settings);
	if (typeof e2eSetting?.value === 'boolean') {
		if (!e2eSetting.value) {
			throw new Error(
				`${SETTING_E2E_ENABLE} is disabled in backend settings`
			);
		}
		return e2eSetting.value;
	}

	const serverSetting = await readServerE2eSetting().catch(() => null);
	if (typeof serverSetting === 'boolean') {
		if (!serverSetting) {
			throw new Error(
				`${SETTING_E2E_ENABLE} is disabled in backend settings`
			);
		}
		return serverSetting;
	}

	if (process.env.NODE_ENV === 'production') {
		console.error(
			`${SETTING_E2E_ENABLE} is missing from backend settings; keeping custom E2EE enabled`
		);
	}

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
	const remoteSettings = await fetchRocketChatPublicSettings(settingsEntries);
	const e2eEnabled = await resolveE2eEnabled(remoteSettings ?? []);
	const settings = filterSettings(
		mergeSettings(remoteSettings, e2eEnabled),
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
