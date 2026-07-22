import { useEffect, useState } from 'react';

/**
 * Placement preference for the global notification-status button in the
 * navigation rail (#576 harmonised model). Mirrors the Live-Chat
 * "via sidebar" pattern: localStorage keeps the UI-only preference, a
 * custom event keeps every consumer in sync. The button itself flips the
 * account-wide `globalMute` — the one switch that overrides everything.
 */
const STORAGE_KEY = 'oriso_notifStatusViaSidebar';
const CHANGE_EVENT = 'oriso:notifStatusViaSidebarChange';

export const isNotifStatusViaSidebar = (): boolean => {
	try {
		return localStorage.getItem(STORAGE_KEY) === '1';
	} catch {
		return false;
	}
};

export const setNotifStatusViaSidebar = (active: boolean): void => {
	try {
		if (active) {
			localStorage.setItem(STORAGE_KEY, '1');
		} else {
			localStorage.removeItem(STORAGE_KEY);
		}
	} catch {
		/* storage errors are non-fatal — the preference just won't persist */
	}
	window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { active } }));
};

/** Hook: keeps UI in sync with the "status button in the rail" preference. */
export const useNotifStatusViaSidebar = (): [boolean, (v: boolean) => void] => {
	const [active, setActive] = useState<boolean>(() =>
		isNotifStatusViaSidebar()
	);

	useEffect(() => {
		const onChange = () => setActive(isNotifStatusViaSidebar());
		window.addEventListener(CHANGE_EVENT, onChange);
		window.addEventListener('storage', onChange);
		return () => {
			window.removeEventListener(CHANGE_EVENT, onChange);
			window.removeEventListener('storage', onChange);
		};
	}, []);

	return [active, setNotifStatusViaSidebar];
};
