import { useCallback, useContext, useEffect } from 'react';
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
 *
 * `latestStored` lifecycle: set by each write (then by its reload); wins
 * over the context while writes are queued. When the queue drains it is
 * dropped after a successful reload, else kept until the context's
 * `userData` changes (`seenUserData`), since only then is the context fresh.
 */
let writeQueue: Promise<unknown> = Promise.resolve();
let queuedWrites = 0;
let latestStored: Partial<UserDataInterface> | null = null;
let seenUserData: unknown;
// Per setting: the number of its newest write, across every caller.
const newestWrite = new Map<string, number>();

/**
 * `saved`: the PATCH went through. `stored`: the setting's last confirmed
 * value. `revertTo`: where the control must go back to; set only when this
 * write failed and no newer write to the same setting was made since, so an
 * older failure never undoes a newer choice.
 */
export interface EmailSettingSaveResult {
	saved: boolean;
	stored: boolean;
	revertTo?: boolean;
}

/**
 * The one write path for e-mail preferences: the profile's switches and the
 * display filter's E-Mail column both call it. After a failed save (error
 * toast shown) the caller puts its control back to `revertTo` when set —
 * never to `!next`, which is wrong once two writes to one setting were
 * queued, and never after a newer write to the same setting.
 */
export const useSaveEmailSetting = () => {
	const { t } = useTranslation();
	// Tolerates a missing provider (list screens rendered in isolation).
	const { userData, reloadUserData } = useContext(UserDataContext) ?? {};
	const addNotification = useContext(NotificationsContext)?.addNotification;
	useEffect(() => {
		if (userData === seenUserData) return;
		seenUserData = userData;
		if (queuedWrites === 0) latestStored = null;
	}, [userData]);
	return useCallback(
		(
			source: EmailSettingSource,
			next: boolean
		): Promise<EmailSettingSaveResult> => {
			queuedWrites += 1;
			const key = emailSettingKey(source);
			const number = (newestWrite.get(key) ?? 0) + 1;
			newestWrite.set(key, number);
			const write = writeQueue.then(async () => {
				const base = latestStored ?? userData;
				const patch = emailSettingPatch(base, source, next);
				let saved = false;
				try {
					await apiPatchUserData(patch);
					latestStored = { ...base, ...patch };
					saved = true;
				} catch {
					addNotification?.({
						title: t('profile.notifications.toggleError.title'),
						text: t(
							'profile.notifications.toggleError.description'
						),
						notificationType: 'error'
					});
					latestStored = base ?? null;
				}
				// Always re-read: what is stored is what the switch must show.
				// A failed reload keeps the save's result and the last known
				// stored state: the context may now be stale.
				let reloaded = false;
				try {
					const fresh = await reloadUserData?.();
					if (fresh) latestStored = fresh;
					reloaded = true;
				} catch {
					// Keep latestStored: the next write builds on it.
				}
				const stored = readEmailSetting(latestStored, source);
				queuedWrites -= 1;
				if (queuedWrites === 0 && reloaded) latestStored = null;
				const newest = newestWrite.get(key) === number;
				return saved || !newest
					? { saved, stored }
					: { saved, stored, revertTo: stored };
			});
			writeQueue = write.catch(() => undefined);
			return write;
		},
		[addNotification, reloadUserData, t, userData]
	);
};
