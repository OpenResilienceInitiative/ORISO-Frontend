import type { AppConfigInterface } from '../globalState/interfaces';

/**
 * Release flag of the practice area, default off until the dev proof. Gate the
 * cards AND the tour registry lookup on it, so no other way starts a flow.
 * `=== true`, like `enableNewNotifications`: unset, false or anything else is off.
 */
export const isPracticeAreaEnabled = (
	settings?: Pick<AppConfigInterface, 'releaseToggles'> | null
): boolean => settings?.releaseToggles?.enablePracticeArea === true;
