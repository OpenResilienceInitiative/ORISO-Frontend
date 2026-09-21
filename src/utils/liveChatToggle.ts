import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { apiPatchUserData } from '../api/apiPatchUserData';
import { UserDataContext } from '../globalState/context/UserDataContext';
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
 * Separate placement preference: whether the consultant drives their Live Chat
 * availability from the navigation rail ("Live Chat über Menü Leiste
 * aktivieren") instead of the My-Profile toggle. When on, the profile toggle is
 * disabled and a persistent Live Chat toggle appears in the rail (desktop and
 * mobile alike). It never calls the availability backend by itself.
 *
 * Source of truth is the consultant's profile (UserService
 * `liveChatViaSidebar` on GET/PATCH /users/data), so it follows the consultant
 * across browsers and devices. The localStorage keys below are only read for
 * the one-time migration and as a fallback for a backend that does not return
 * the field yet.
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

const readLocalLiveChatViaSidebar = (): boolean => {
	try {
		return (
			localStorage.getItem(SIDEBAR_STORAGE_KEY) === '1' ||
			localStorage.getItem(LEGACY_SIDEBAR_STORAGE_KEY) === '1'
		);
	} catch {
		return false;
	}
};

const writeLocalLiveChatViaSidebar = (active: boolean): void => {
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
};

const clearLocalLiveChatViaSidebar = (): void => {
	try {
		localStorage.removeItem(SIDEBAR_STORAGE_KEY);
		localStorage.removeItem(LEGACY_SIDEBAR_STORAGE_KEY);
	} catch {
		/* non-fatal */
	}
};

/** In-tab change event, kept so listeners outside React stay informed. */
const notifyLiveChatViaSidebarChange = (active: boolean): void => {
	window.dispatchEvent(
		new CustomEvent(SIDEBAR_CHANGE_EVENT, { detail: { active } })
	);
};

/**
 * One migration per page load, shared by every mounted consumer (rail and
 * profile both use the hook). A failed PATCH is not retried until the next
 * load; the local value stays in place meanwhile.
 */
let sidebarMigration: Promise<void> | null = null;
let sidebarMigrationFailed = false;

/** Test-only: simulates a fresh page load for the migration state. */
export const resetLiveChatViaSidebarMigrationForTests = (): void => {
	sidebarMigration = null;
	sidebarMigrationFailed = false;
};

/**
 * Hook: the "control from the rail" preference, read from and written to the
 * consultant's profile via UserDataContext, so the NavigationBar and the
 * My-Profile checkbox always agree.
 *
 * - Profile returns a boolean → it is authoritative. A leftover browser "on"
 *   is migrated once (PATCH true, then the local keys are removed).
 * - Profile does not return the field (UserService without
 *   `liveChatViaSidebar`, i.e. before that backend change is deployed) → fall
 *   back to the browser value, exactly like before, so nothing regresses.
 *
 * The setter updates the context optimistically and rolls back (and rejects)
 * when the PATCH fails.
 */
export const useLiveChatViaSidebar = (): [
	boolean,
	(active: boolean) => Promise<void>
] => {
	const userDataContext = useContext(UserDataContext);
	const userData = userDataContext?.userData;
	const setUserData = userDataContext?.setUserData;
	const userDataRef = useRef(userData);
	userDataRef.current = userData;

	const profileValue = userData?.liveChatViaSidebar;
	const profileHasField = typeof profileValue === 'boolean';
	const [localValue, setLocalValue] = useState<boolean>(() =>
		readLocalLiveChatViaSidebar()
	);

	useEffect(() => {
		const onChange = () => setLocalValue(readLocalLiveChatViaSidebar());
		window.addEventListener(SIDEBAR_CHANGE_EVENT, onChange);
		window.addEventListener('storage', onChange);
		return () => {
			window.removeEventListener(SIDEBAR_CHANGE_EVENT, onChange);
			window.removeEventListener('storage', onChange);
		};
	}, []);

	useEffect(() => {
		if (!profileHasField || !readLocalLiveChatViaSidebar()) return;
		if (profileValue) {
			clearLocalLiveChatViaSidebar();
			notifyLiveChatViaSidebarChange(true);
			return;
		}
		if (sidebarMigration || sidebarMigrationFailed) return;
		sidebarMigration = apiPatchUserData({ liveChatViaSidebar: true })
			.then(() => {
				clearLocalLiveChatViaSidebar();
				if (userDataRef.current && setUserData) {
					setUserData({
						...userDataRef.current,
						liveChatViaSidebar: true
					});
				}
				notifyLiveChatViaSidebarChange(true);
			})
			.catch(() => {
				sidebarMigrationFailed = true;
			})
			.finally(() => {
				sidebarMigration = null;
			});
	}, [profileHasField, profileValue, setUserData]);

	// While a browser-only "on" waits for (or failed) its migration, keep
	// showing it — the consultant chose it and must not lose the rail toggle.
	const active = profileHasField
		? Boolean(profileValue) || localValue
		: localValue;

	const update = useCallback(
		async (next: boolean) => {
			const previous = userDataRef.current;
			const backendKnowsField =
				typeof previous?.liveChatViaSidebar === 'boolean';
			if (!backendKnowsField) {
				// Older UserService: keep the browser-only behaviour, but still
				// send the PATCH so the value lands once the backend supports it.
				writeLocalLiveChatViaSidebar(next);
				notifyLiveChatViaSidebarChange(next);
				await apiPatchUserData({ liveChatViaSidebar: next }).catch(
					() => undefined
				);
				return;
			}
			setUserData?.({ ...previous, liveChatViaSidebar: next });
			try {
				await apiPatchUserData({ liveChatViaSidebar: next });
				clearLocalLiveChatViaSidebar();
				notifyLiveChatViaSidebarChange(next);
			} catch (error) {
				setUserData?.(previous);
				throw error;
			}
		},
		[setUserData]
	);

	return [active, update];
};
