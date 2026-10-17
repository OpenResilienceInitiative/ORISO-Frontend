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

/*
 * Shared by every caller: the endpoint replaces the settings blob and the
 * toggle list whole, so writes go one at a time, each built on the state
 * the previous one left (Codex review on FE#1752).
 */
let writeQueue: Promise<unknown> = Promise.resolve();
let queuedWrites = 0;
let latestStored: Partial<UserDataInterface> | null = null;

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
		(source: EmailSettingSource, next: boolean): Promise<boolean> => {
			queuedWrites += 1;
			const write = writeQueue.then(async () => {
				const base = latestStored ?? userData;
				const patch = emailSettingPatch(base, source, next);
				try {
					await apiPatchUserData(patch);
					latestStored = { ...base, ...patch };
					return true;
				} catch {
					addNotification?.({
						title: t('profile.notifications.toggleError.title'),
						text: t(
							'profile.notifications.toggleError.description'
						),
						notificationType: 'error'
					});
					latestStored = base ?? null;
					return false;
				} finally {
					try {
						// Always re-read: what is stored is what the switch must show.
						const fresh = await reloadUserData?.();
						if (fresh) latestStored = fresh;
					} finally {
						queuedWrites -= 1;
						if (queuedWrites === 0) latestStored = null;
					}
				}
			});
			writeQueue = write.catch(() => undefined);
			return write;
		},
		[addNotification, reloadUserData, t, userData]
	);
};
