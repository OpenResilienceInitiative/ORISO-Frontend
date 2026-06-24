import { apiMatrixSettingsPublic } from './apiMatrixSettingsPublic';
import type { TRocketChatSettingsPublicResponse } from './apiRocketChatSettingsShared';

export {
	SETTING_E2E_ENABLE,
	SETTING_MESSAGE_MAXALLOWEDSIZE,
	SETTING_FILEUPLOAD_MAXFILESIZE,
	SETTING_MESSAGE_ALLOWDELETING,
	SETTING_HIDE_SYSTEM_MESSAGES,
	SETTING_MESSAGE_SHOWDELETEDSTATUS,
	type TSetting,
	type IStringSetting,
	type INumberSetting,
	type IBooleanSetting,
	type IArraySetting,
	type TRocketChatSettingsPublicResponse
} from './apiRocketChatSettingsShared';

export const apiRocketChatSettingsPublic = async (
	settingsEntries: string[] = null
): Promise<TRocketChatSettingsPublicResponse> =>
	apiMatrixSettingsPublic(settingsEntries);
