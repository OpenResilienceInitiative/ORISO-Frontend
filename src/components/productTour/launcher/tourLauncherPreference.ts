import { useCallback, useSyncExternalStore } from 'react';

/**
 * Whether the "?" tour launcher is shown, per user in this browser
 * (Frank, 2026-11-18: the button must be able to disappear completely).
 * Default: shown. Storage can be missing or throw (private mode, blocked
 * site data); the launcher then simply stays at its default.
 */
const KEY_PREFIX = 'oriso.tourLauncher.hidden.';
const listeners = new Set<() => void>();

const keyFor = (userId: string) => `${KEY_PREFIX}${userId}`;

export const readTourLauncherVisible = (userId?: string): boolean => {
	if (!userId) return true;
	try {
		return window.localStorage.getItem(keyFor(userId)) !== 'true';
	} catch {
		return true;
	}
};

export const writeTourLauncherVisible = (userId: string, visible: boolean) => {
	try {
		if (visible) {
			window.localStorage.removeItem(keyFor(userId));
		} else {
			window.localStorage.setItem(keyFor(userId), 'true');
		}
	} catch {
		// Not persisted; the switch still applies until the page reloads.
	}
	listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
	listeners.add(listener);
	const onStorage = (event: StorageEvent) => {
		if (!event.key || event.key.startsWith(KEY_PREFIX)) listener();
	};
	window.addEventListener('storage', onStorage);
	return () => {
		listeners.delete(listener);
		window.removeEventListener('storage', onStorage);
	};
};

/** `[visible, setVisible]` for the signed-in user; other tabs stay in sync. */
export const useTourLauncherVisible = (
	userId?: string
): [boolean, (visible: boolean) => void] => {
	const getSnapshot = useCallback(
		() => readTourLauncherVisible(userId),
		[userId]
	);
	const visible = useSyncExternalStore(subscribe, getSnapshot, () => true);
	const setVisible = useCallback(
		(next: boolean) => {
			if (userId) writeTourLauncherVisible(userId, next);
		},
		[userId]
	);
	return [visible, setVisible];
};
