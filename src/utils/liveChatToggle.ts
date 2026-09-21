import { useCallback, useEffect, useState } from 'react';
import { FETCH_ERRORS } from '../api/fetchData';
import {
	apiGetLiveChatAvailability,
	apiHeartbeatLiveChatAvailability,
	apiSetLiveChatAvailability
} from '../api/apiSetLiveChatAvailability';
import {
	LIVE_CHAT_AVAILABILITY_CHANGE_EVENT,
	LIVE_CHAT_AVAILABILITY_STORAGE_KEY,
	LiveChatAvailabilityLossReason,
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
	/** Set when the client switched off on its own; cleared by the next toggle. */
	lostReason: LiveChatAvailabilityLossReason | null;
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
	const [lostReason, setLostReason] =
		useState<LiveChatAvailabilityLossReason | null>(null);

	useEffect(() => {
		let mounted = true;
		const reconcile = async () => {
			const requestedAtRevision = availabilityRevision;
			try {
				const backendActive = await apiGetLiveChatAvailability();
				if (mounted && requestedAtRevision === availabilityRevision) {
					setActive(backendActive);
					setError(false);
					// #1485: a stored "live" the server does not back is dropped
					// here, and the consultant is told, instead of left to linger.
					if (!backendActive && readLiveChatAvailabilityPreference())
						persistLiveChatAvailabilityPreference(
							false,
							'leaseLost'
						);
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
				event as CustomEvent<{
					active: boolean;
					error?: boolean;
					reason?: LiveChatAvailabilityLossReason;
				}>
			).detail;
			if (detail) {
				setActive(detail.active);
				setError(Boolean(detail.error));
				setLostReason(detail.reason ?? null);
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
			setLostReason(null);
		} catch (updateError) {
			setError(true);
			throw updateError;
		} finally {
			setPending(false);
		}
	}, []);

	return [active, update, { loading, pending, error, lostReason }];
};

/**
 * The server answered, and the answer was "no": the session is not allowed to
 * refresh the lease (403) or is no longer signed in (401). Retrying the same
 * request cannot change that, so the client must stop claiming "live" (#1485).
 * Anything else is treated as transient.
 */
const heartbeatRefusalReason = (
	error: unknown
): LiveChatAvailabilityLossReason | null => {
	if (!(error instanceof Error)) return null;
	if (error.message === FETCH_ERRORS.UNAUTHORIZED) return 'sessionExpired';
	if (error.message === FETCH_ERRORS.FORBIDDEN) return 'refused';
	return null;
};

/** The server no longer counts this consultant: switch off everywhere. */
const dropLiveChatAvailability = (
	reason: LiveChatAvailabilityLossReason
): void => {
	availabilityRevision += 1;
	persistLiveChatAvailabilityPreference(false, reason);
};

/** Mirrors `consultant.availability.activeWindowMs` in ORISO-UserService. */
export const LIVE_CHAT_LEASE_MS = 120_000;
export const LIVE_CHAT_HEARTBEAT_INTERVAL_MS = 45_000;

/**
 * Mounted exactly once by the consultant navigation shell.
 *
 * A refusal or a server answer of "no lease" switches off at once. A transient
 * failure (no response, timeout, 5xx) is retried quietly on the next beat, but
 * once nothing was acknowledged for longer than the lease the server has
 * stopped counting this consultant, so the client stops claiming "live" too.
 */
export const useLiveChatAvailabilityHeartbeat = (
	enabled: boolean,
	active: boolean
): void => {
	useEffect(() => {
		if (!enabled || !active) return;
		// `active` only turns true once the backend acknowledged it, so the
		// lease is fresh when this effect starts.
		let leaseWatchdog = 0;
		const armLeaseWatchdog = () => {
			window.clearTimeout(leaseWatchdog);
			const armedAtRevision = availabilityRevision;
			leaseWatchdog = window.setTimeout(() => {
				if (armedAtRevision !== availabilityRevision) return;
				dropLiveChatAvailability('connectionLost');
			}, LIVE_CHAT_LEASE_MS);
		};
		armLeaseWatchdog();
		const heartbeat = window.setInterval(() => {
			const requestedAtRevision = availabilityRevision;
			void apiHeartbeatLiveChatAvailability()
				.then((leaseActive) => {
					if (requestedAtRevision !== availabilityRevision) return;
					if (leaseActive) armLeaseWatchdog();
					else dropLiveChatAvailability('leaseLost');
				})
				.catch((error: unknown) => {
					if (requestedAtRevision !== availabilityRevision) return;
					const refusal = heartbeatRefusalReason(error);
					if (refusal) dropLiveChatAvailability(refusal);
					// Otherwise transient: the next beat is the retry, and the
					// watchdog bounds how long "live" may be claimed without one.
				});
		}, LIVE_CHAT_HEARTBEAT_INTERVAL_MS);
		return () => {
			window.clearInterval(heartbeat);
			window.clearTimeout(leaseWatchdog);
		};
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
