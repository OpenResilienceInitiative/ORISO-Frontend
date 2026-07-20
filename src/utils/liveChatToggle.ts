import { useEffect, useState } from 'react';
import { apiSetLiveChatAvailability } from '../api/apiSetLiveChatAvailability';

/**
 * LocalStorage-backed toggle for whether the consultant is "live-chat
 * available". When on, anonymous enquiries are fetched and merged into the
 * consultant's enquiry list; when off, only registered enquiries are shown.
 *
 * Exposed as a plain util + a tiny hook so both the NavigationBar (owner of
 * the button) and the SessionsList (consumer of the state) stay in sync
 * without threading another context through the app.
 */
const STORAGE_KEY = 'caritas_liveChatAvailability';
const CHANGE_EVENT = 'caritas:liveChatAvailabilityChange';

/**
 * Separate, UI-only preference: whether the consultant drives their Live Chat
 * availability from the navigation rail ("Live Chat über Menü Leiste
 * aktivieren") instead of the My-Profile toggle. When on, the profile toggle is
 * disabled and a persistent Live Chat toggle appears in the rail. This is a
 * placement preference — it never calls the availability backend by itself.
 */
const SIDEBAR_STORAGE_KEY = 'caritas_liveChatViaSidebar';
const SIDEBAR_CHANGE_EVENT = 'caritas:liveChatViaSidebarChange';

export const isLiveChatAvailable = (): boolean => {
	try {
		return localStorage.getItem(STORAGE_KEY) === '1';
	} catch {
		return false;
	}
};

export const setLiveChatAvailable = (active: boolean): void => {
	try {
		if (active) {
			localStorage.setItem(STORAGE_KEY, '1');
		} else {
			localStorage.removeItem(STORAGE_KEY);
		}
	} catch {
		/* storage errors are non-fatal — the toggle just won't persist */
	}
	/* Tell the backend immediately so the anonymous availability count reflects
	 * this consultant going available/unavailable without waiting for a poll. */
	void apiSetLiveChatAvailability(active);
	window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { active } }));
};

/** Hook: keeps UI in sync with the storage-backed flag. */
export const useLiveChatAvailable = (): [boolean, (v: boolean) => void] => {
	const [active, setActive] = useState<boolean>(() => isLiveChatAvailable());

	useEffect(() => {
		const onChange = () => setActive(isLiveChatAvailable());
		window.addEventListener(CHANGE_EVENT, onChange);
		/* Also listen to cross-tab updates via the native storage event. */
		window.addEventListener('storage', onChange);
		return () => {
			window.removeEventListener(CHANGE_EVENT, onChange);
			window.removeEventListener('storage', onChange);
		};
	}, []);

	return [active, setLiveChatAvailable];
};

export const isLiveChatViaSidebar = (): boolean => {
	try {
		return localStorage.getItem(SIDEBAR_STORAGE_KEY) === '1';
	} catch {
		return false;
	}
};

export const setLiveChatViaSidebar = (active: boolean): void => {
	try {
		if (active) {
			localStorage.setItem(SIDEBAR_STORAGE_KEY, '1');
		} else {
			localStorage.removeItem(SIDEBAR_STORAGE_KEY);
		}
	} catch {
		/* storage errors are non-fatal — the preference just won't persist */
	}
	window.dispatchEvent(
		new CustomEvent(SIDEBAR_CHANGE_EVENT, { detail: { active } })
	);
};

/** Hook: keeps UI in sync with the "control from the rail" preference. */
export const useLiveChatViaSidebar = (): [boolean, (v: boolean) => void] => {
	const [active, setActive] = useState<boolean>(() => isLiveChatViaSidebar());

	useEffect(() => {
		const onChange = () => setActive(isLiveChatViaSidebar());
		window.addEventListener(SIDEBAR_CHANGE_EVENT, onChange);
		window.addEventListener('storage', onChange);
		return () => {
			window.removeEventListener(SIDEBAR_CHANGE_EVENT, onChange);
			window.removeEventListener('storage', onChange);
		};
	}, []);

	return [active, setLiveChatViaSidebar];
};
