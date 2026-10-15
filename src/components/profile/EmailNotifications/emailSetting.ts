import { useCallback, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import cloneDeep from 'lodash/cloneDeep';
import get from 'lodash/get';
import set from 'lodash/set';
import { NotificationsContext, UserDataContext } from '../../../globalState';
import type { UserDataInterface } from '../../../globalState/interfaces';
import { apiPatchUserData } from '../../../api/apiPatchUserData';
import type { NotificationSource } from './notificationMatrix';

/**
 * One stored e-mail preference: a matrix source, or a raw path into
 * `emailNotifications` (the master switch `emailNotificationsEnabled`).
 */
export type EmailSettingSource =
	| NotificationSource
	| { kind: 'path'; name: string };

const pathOf = (
	source: Exclude<EmailSettingSource, { kind: 'emailToggle' }>
): string =>
	source.kind === 'settings' ? `settings.${source.field}` : source.name;

/** Stable key of a source, e.g. for optimistic state. */
export const emailSettingKey = (source: EmailSettingSource): string =>
	source.kind === 'emailToggle' ? `toggle:${source.type}` : pathOf(source);

export const readEmailSetting = (
	userData: Partial<UserDataInterface> | null | undefined,
	source: EmailSettingSource
): boolean =>
	source.kind === 'emailToggle'
		? (userData?.emailToggles?.find((toggle) => toggle.name === source.type)
				?.state ?? false)
		: Boolean(get(userData?.emailNotifications, pathOf(source), false));

/**
 * The PATCH body that stores `next` for `source`. `emailToggles` must go
 * back whole (the endpoint replaces the list), the settings blob too.
 */
export const emailSettingPatch = (
	userData: Partial<UserDataInterface> | null | undefined,
	source: EmailSettingSource,
	next: boolean
): Partial<UserDataInterface> =>
	source.kind === 'emailToggle'
		? {
				emailToggles: [...(userData?.emailToggles ?? [])].map(
					(toggle) =>
						toggle.name === source.type
							? { ...toggle, state: next }
							: toggle
				)
			}
		: {
				emailNotifications: set(
					cloneDeep(userData?.emailNotifications ?? {}),
					pathOf(source),
					next
				) as UserDataInterface['emailNotifications']
			};

/**
 * The one write path for e-mail preferences: the profile's switches and the
 * display filter's E-Mail column both call it. Resolves `false` after a
 * failed save (error toast shown) so the caller can put its control back.
 */
export const useSaveEmailSetting = () => {
	const { t } = useTranslation();
	// Tolerates a missing provider (list screens rendered in isolation).
	const { userData, reloadUserData } = useContext(UserDataContext) ?? {};
	const addNotification = useContext(NotificationsContext)?.addNotification;
	return useCallback(
		async (source: EmailSettingSource, next: boolean): Promise<boolean> => {
			try {
				await apiPatchUserData(
					emailSettingPatch(userData, source, next)
				);
				return true;
			} catch {
				addNotification?.({
					title: t('profile.notifications.toggleError.title'),
					text: t('profile.notifications.toggleError.description'),
					notificationType: 'error'
				});
				return false;
			} finally {
				// Always re-read: what is stored is what the switch must show.
				await reloadUserData?.();
			}
		},
		[addNotification, reloadUserData, t, userData]
	);
};
