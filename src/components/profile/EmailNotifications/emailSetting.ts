import {
	useCallback,
	useContext,
	useEffect,
	useSyncExternalStore
} from 'react';
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
 *
 * React may render a reload's snapshot only after later writes settled, so
 * every snapshot a write's reload fetched is tagged with that write's number
 * (`fetchedBy`); one older than the newest write is never taken as fresh.
 */
let writeQueue: Promise<unknown> = Promise.resolve();
let queuedWrites = 0;
let latestStored: Partial<UserDataInterface> | null = null;
let seenUserData: unknown;
let writeNumber = 0;
const fetchedBy = new WeakMap<object, number>();

/*
 * What each setting's control shows, shared by every caller (the profile
 * switches and the display filter's E-Mail column). `value` overrides the
 * context while it is set: optimistic while writes are in flight, then the
 * newest write's outcome. Only the newest write may settle it; an older
 * write's result, rollback or reload never shows. It is dropped on fresh
 * `userData` once no write for the setting is in flight.
 */
interface ShownSetting {
	/** `writeNumber` of the newest write to this setting. */
	newest: number;
	inFlight: number;
	value?: boolean;
}
const shownSettings = new Map<string, ShownSetting>();
const shownListeners = new Set<() => void>();
let shownVersion = 0;
const publishShown = () => {
	shownVersion += 1;
	shownListeners.forEach((listener) => listener());
};
const subscribeShown = (listener: () => void) => {
	shownListeners.add(listener);
	return () => {
		shownListeners.delete(listener);
	};
};
const shownSnapshot = () => shownVersion;

/** `saved`: the PATCH went through. `stored`: the setting's last confirmed value. */
export interface EmailSettingSaveResult {
	saved: boolean;
	stored: boolean;
}

/**
 * The write queue for e-mail preferences. Controls use `useEmailSettings`,
 * which decides what they show; this only stores and reports.
 */
export const useSaveEmailSetting = () => {
	const { t } = useTranslation();
	// Tolerates a missing provider (list screens rendered in isolation).
	const { userData, reloadUserData } = useContext(UserDataContext) ?? {};
	const addNotification = useContext(NotificationsContext)?.addNotification;
	useEffect(() => {
		if (userData === seenUserData) return;
		seenUserData = userData;
		const from = userData ? fetchedBy.get(userData) : undefined;
		if (queuedWrites === 0 && (from === undefined || from === writeNumber))
			latestStored = null;
		let dropped = false;
		shownSettings.forEach((entry) => {
			if (entry.inFlight > 0 || entry.value === undefined) return;
			if (from !== undefined && from < entry.newest) return;
			entry.value = undefined;
			dropped = true;
		});
		if (dropped) publishShown();
	}, [userData]);
	return useCallback(
		(
			source: EmailSettingSource,
			next: boolean
		): Promise<EmailSettingSaveResult> => {
			queuedWrites += 1;
			writeNumber += 1;
			const number = writeNumber;
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
					if (fresh) {
						latestStored = fresh;
						fetchedBy.set(fresh, number);
					}
					reloaded = true;
				} catch {
					// Keep latestStored: the next write builds on it.
				}
				const stored = readEmailSetting(latestStored, source);
				queuedWrites -= 1;
				if (queuedWrites === 0 && reloaded) latestStored = null;
				return { saved, stored };
			});
			writeQueue = write.catch(() => undefined);
			return write;
		},
		[addNotification, reloadUserData, t, userData]
	);
};

/**
 * The one way a control reads and changes an e-mail preference. `read`
 * gives what the control shows; `change` writes through the shared queue.
 * While a newer write to the same setting is in flight, an older write's
 * outcome shows nothing. The newest write settles the control: to the
 * value it wrote when the PATCH went through (whatever the reload did),
 * else to the last value the server confirmed.
 */
export const useEmailSettings = () => {
	const userData = useContext(UserDataContext)?.userData;
	const save = useSaveEmailSetting();
	const version = useSyncExternalStore(
		subscribeShown,
		shownSnapshot,
		shownSnapshot
	);
	const read = useCallback(
		(source: EmailSettingSource): boolean =>
			shownSettings.get(emailSettingKey(source))?.value ??
			readEmailSetting(userData, source),
		// `version`: the shown values changed.
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[userData, version]
	);
	const change = useCallback(
		async (source: EmailSettingSource, next: boolean) => {
			// The active option stays clickable: no write, nothing to settle.
			if (next === read(source)) return;
			const key = emailSettingKey(source);
			const entry = shownSettings.get(key) ?? { newest: 0, inFlight: 0 };
			shownSettings.set(key, entry);
			const result = save(source, next);
			// `save` numbered the write synchronously.
			const number = writeNumber;
			entry.newest = number;
			entry.inFlight += 1;
			entry.value = next;
			publishShown();
			const { saved, stored } = await result;
			entry.inFlight -= 1;
			if (number !== entry.newest) return;
			entry.value = saved ? next : stored;
			publishShown();
		},
		[read, save]
	);
	return { read, change };
};
