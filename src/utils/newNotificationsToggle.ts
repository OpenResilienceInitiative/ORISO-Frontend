import type { AppConfigInterface } from '../globalState/interfaces';

/**
 * The release toggle that routes the new notification screens into the
 * profile (EmailNotification, cross-device panel) instead of the legacy ones.
 */
export const usesNewNotifications = (
	config: Pick<AppConfigInterface, 'releaseToggles'> | null | undefined
): boolean => config?.releaseToggles?.enableNewNotifications === true;
