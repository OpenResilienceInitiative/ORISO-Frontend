import { useCallback, useEffect, useState } from 'react';
import {
	apiGetLiveChatAvailability,
	apiHeartbeatLiveChatAvailability,
	apiSetLiveChatAvailability
} from '../api/apiSetLiveChatAvailability';
import {
	LIVE_CHAT_AVAILABILITY_CHANGE_EVENT,
	LIVE_CHAT_AVAILABILITY_STORAGE_KEY,
	persistLiveChatAvailabilityPreference,
	readLiveChatAvailabilityPreference
} from './liveChatAvailabilityStorage';

/**
 * Backend-authoritative state for whether the consultant is "live-chat
 * available". LocalStorage keeps only the consultant's desired preference;
 * it must never make the visible or routing state active by itself.
 *
 * Exposed as a plain util + a tiny hook so both the NavigationBar (owner of
 * the button) and the SessionsList (consumer of the state) stay in sync
 * without threading another context through the app.
 */
/**
 * Separate, UI-only preference: whether the consultant drives their Live Chat
 * availability from the navigation rail ("Live Chat über Menü Leiste
 * aktivieren") instead of the My-Profile toggle. When on, the profile toggle is
 * disabled and a persistent Live Chat toggle appears in the rail. This is a
 * placement preference — it never calls the availability backend by itself.
 */
const SIDEBAR_STORAGE_KEY = 'oriso_liveChatViaSidebar';
const SIDEBAR_CHANGE_EVENT = 'oriso:liveChatViaSidebarChange';
/** Written by pre-rename builds (FE-H05, #178); read once, then dropped. */
const LEGACY_SIDEBAR_STORAGE_KEY = 'caritas_liveChatViaSidebar';
let availabilityRevision = 0;

export const isLiveChatAvailable = (): boolean => {
	return readLiveChatAvailabilityPreference();
};

export const setLiveChatAvailable = async (active: boolean): Promise<void> => {
	await apiSetLiveChatAvailability(active);
	availabilityRevision += 1;
	persistLiveChatAvailabilityPreference(active);
};

export interface LiveChatAvailabilityState {
	loading: boolean;
	pending: boolean;
	error: boolean;
}

/** Hook: visible state always starts from and reconciles with the backend. */
export const useLiveChatAvailable = (): [
	boolean,
	(v: boolean) => Promise<void>,
	LiveChatAvailabilityState
] => {
	const [active, setActive] = useState(false);
	const [loading, setLoading] = useState(true);
	const [pending, setPending] = useState(false);
	const [error, setError] = useState(false);

	useEffect(() => {
		let mounted = true;
		const reconcile = async () => {
			const requestedAtRevision = availabilityRevision;
			try {
				const backendActive = await apiGetLiveChatAvailability();
				if (mounted && requestedAtRevision === availabilityRevision) {
					setActive(backendActive);
					setError(false);
				}
			} catch {
				if (mounted && requestedAtRevision === availabilityRevision) {
					setActive(false);
					setError(true);
				}
			} finally {
				if (mounted) setLoading(false);
			}
		};
		const onChange = (event: Event) => {
			const detail = (
				event as CustomEvent<{ active: boolean; error?: boolean }>
			).detail;
			if (detail) {
				setActive(detail.active);
				setError(Boolean(detail.error));
			}
		};
		const onStorage = (event: StorageEvent) => {
			if (event.key === LIVE_CHAT_AVAILABILITY_STORAGE_KEY)
				void reconcile();
		};
		void reconcile();
		window.addEventListener(LIVE_CHAT_AVAILABILITY_CHANGE_EVENT, onChange);
		window.addEventListener('storage', onStorage);
		return () => {
			mounted = false;
			window.removeEventListener(
				LIVE_CHAT_AVAILABILITY_CHANGE_EVENT,
				onChange
			);
			window.removeEventListener('storage', onStorage);
		};
	}, []);

	const update = useCallback(async (nextActive: boolean) => {
		setPending(true);
		setError(false);
		try {
			await setLiveChatAvailable(nextActive);
			setActive(nextActive);
		} catch (updateError) {
			setError(true);
			throw updateError;
		} finally {
			setPending(false);
		}
	}, []);

	return [active, update, { loading, pending, error }];
};

/** Mounted exactly once by the consultant navigation shell. */
export const useLiveChatAvailabilityHeartbeat = (
	enabled: boolean,
	active: boolean
): void => {
	useEffect(() => {
		if (!enabled || !active) return;
		const heartbeat = window.setInterval(() => {
			const requestedAtRevision = availabilityRevision;
			void apiHeartbeatLiveChatAvailability()
				.then((leaseActive) => {
					if (requestedAtRevision !== availabilityRevision) return;
					if (!leaseActive) {
						availabilityRevision += 1;
						persistLiveChatAvailabilityPreference(false);
					}
				})
				.catch(() => {
					if (requestedAtRevision !== availabilityRevision) return;
					availabilityRevision += 1;
					window.dispatchEvent(
						new CustomEvent(LIVE_CHAT_AVAILABILITY_CHANGE_EVENT, {
							detail: { active: false, error: true }
						})
					);
				});
		}, 45_000);
		return () => window.clearInterval(heartbeat);
	}, [active, enabled]);
};

export const isLiveChatViaSidebar = (): boolean => {
	try {
		return (
			localStorage.getItem(SIDEBAR_STORAGE_KEY) === '1' ||
			localStorage.getItem(LEGACY_SIDEBAR_STORAGE_KEY) === '1'
		);
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
		localStorage.removeItem(LEGACY_SIDEBAR_STORAGE_KEY);
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
