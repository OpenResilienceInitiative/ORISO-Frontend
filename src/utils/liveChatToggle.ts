import { useCallback, useEffect, useState } from 'react';
import { FETCH_ERRORS } from '../api/fetchData';
import {
	LIVE_CHAT_HEARTBEAT_TIMEOUT_MS,
	apiGetLiveChatAvailability,
	apiHeartbeatLiveChatAvailability,
	apiSetLiveChatAvailability
} from '../api/apiSetLiveChatAvailability';
import {
	LIVE_CHAT_AVAILABILITY_CHANGE_EVENT,
	LIVE_CHAT_AVAILABILITY_LOSS_STORAGE_KEY,
	LIVE_CHAT_AVAILABILITY_STORAGE_KEY,
	LiveChatAvailabilityLossReason,
	parseLiveChatAvailabilityLoss,
	persistLiveChatAvailabilityPreference,
	readLastLiveChatHeartbeatAcknowledged,
	readLiveChatAvailabilityPreference,
	readLiveChatSessionEpoch,
	recordLiveChatHeartbeatAcknowledged
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
/**
 * Every consumer in the tab receives the same `storage` event; only the first
 * may invalidate, or each would discard the requests the others just sent.
 */
let lastInvalidatingStorageEvent: StorageEvent | null = null;
const invalidateForStorageChange = (event: StorageEvent): void => {
	if (lastInvalidatingStorageEvent === event) return;
	lastInvalidatingStorageEvent = event;
	availabilityRevision += 1;
};

export const isLiveChatAvailable = (): boolean => {
	return readLiveChatAvailabilityPreference();
};

/**
 * Resolves `false` when the session was torn down while the request was in
 * flight: its answer then writes nothing and changes no state.
 */
export const setLiveChatAvailable = async (
	active: boolean
): Promise<boolean> => {
	const epoch = readLiveChatSessionEpoch();
	const sentAt = Date.now();
	await apiSetLiveChatAvailability(active);
	if (epoch !== readLiveChatSessionEpoch()) return false;
	availabilityRevision += 1;
	// An acknowledged enable starts a fresh lease, like a heartbeat — no
	// earlier than the request was sent, so it is counted from there. It is
	// written before the preference, so another tab never sees the new
	// preference without the acknowledgement that outdates its old checks.
	if (active) recordLiveChatHeartbeatAcknowledged(sentAt);
	persistLiveChatAvailabilityPreference(active);
	return true;
};

/**
 * Did any tab have an enable or heartbeat acknowledged after `since`? Every
 * decision to switch off checks this first: evidence older than the latest
 * renewal (another tab's, whose storage event may not have arrived yet)
 * describes a lease that has since been renewed.
 */
export interface RenewalMark {
	at: number;
	generation: number;
}
/** Taken when a request is sent: which acknowledgements it predates. */
const markRenewals = (): RenewalMark => ({
	at: Date.now(),
	generation: readLastLiveChatHeartbeatAcknowledged().generation
});
const renewedSince = (mark: RenewalMark): boolean => {
	const last = readLastLiveChatHeartbeatAcknowledged();
	// The generation orders acknowledgements even within one millisecond;
	// the answer time covers a record written before generations existed.
	return last.generation > mark.generation || last.ackedAt > mark.at;
};

/** Ms left of the lease the latest acknowledgement (any tab) started. */
const leaseLeftNow = (): number =>
	readLastLiveChatHeartbeatAcknowledged().sentAt +
	LIVE_CHAT_LEASE_MS -
	Date.now();

const isCurrentLossRecord = (value: string | null): boolean => {
	try {
		return (
			localStorage.getItem(LIVE_CHAT_AVAILABILITY_LOSS_STORAGE_KEY) ===
			value
		);
	} catch {
		return true;
	}
};

/** The server no longer counts this consultant: switch off everywhere. */
const dropLiveChatAvailability = (
	reason: LiveChatAvailabilityLossReason
): void => {
	availabilityRevision += 1;
	persistLiveChatAvailabilityPreference(false, reason);
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
			const sent = markRenewals();
			try {
				const backendActive = await apiGetLiveChatAvailability();
				// A "no" older than another tab's acknowledged enable is
				// stale; that tab's storage event will reconcile again.
				const staleNo = !backendActive && renewedSince(sent);
				if (
					mounted &&
					requestedAtRevision === availabilityRevision &&
					!staleNo
				) {
					// #1485: a stored "live" the server does not back is dropped
					// here, and the consultant is told, instead of left to linger.
					// Dropping bumps the revision, so another consumer's older,
					// still-pending "true" cannot revive the switch afterwards.
					if (!backendActive && readLiveChatAvailabilityPreference())
						dropLiveChatAvailability('leaseLost');
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
			if (event.key === LIVE_CHAT_AVAILABILITY_STORAGE_KEY) {
				// Another tab changed the preference: an answer to a request
				// sent before that change describes the old state, so it is
				// discarded instead of undoing the change (#1485).
				invalidateForStorageChange(event);
				void reconcile();
			}
			if (event.key === LIVE_CHAT_AVAILABILITY_LOSS_STORAGE_KEY) {
				// Another tab switched off on its own (#1485): say why here
				// too, and keep this tab's in-flight answers from reviving it.
				const reason = parseLiveChatAvailabilityLoss(event.newValue);
				// A queued event can arrive after this tab switched on again,
				// which removed the record: only the record storage still
				// holds may switch this tab off.
				if (reason && !isCurrentLossRecord(event.newValue)) return;
				if (reason) {
					invalidateForStorageChange(event);
					setActive(false);
				}
				setLostReason(reason);
			}
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
			if (!(await setLiveChatAvailable(nextActive))) return;
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

/** Mirrors `consultant.availability.activeWindowMs` in ORISO-UserService. */
export const LIVE_CHAT_LEASE_MS = 120_000;
export const LIVE_CHAT_HEARTBEAT_INTERVAL_MS = 45_000;
/**
 * With no acknowledgement on record the lease has an unknown remainder (the
 * GET only says one exists). The first beat gets one quick retry, and "live"
 * is claimed only this long, plus the watchdog's final request-timeout grace
 * (15 s in all), unless some tab renews the lease meanwhile.
 */
export const LIVE_CHAT_UNKNOWN_LEASE_MS = 10_000;
export const LIVE_CHAT_FIRST_BEAT_RETRY_MS = 2_000;

/**
 * Mounted exactly once by the consultant navigation shell.
 *
 * A refusal or a server answer of "no lease" switches off at once. A transient
 * failure (no response, timeout, 5xx) is retried quietly on the next beat, but
 * once no tab had a heartbeat acknowledged for longer than the lease the
 * server has stopped counting this consultant, so the client stops claiming
 * "live" too.
 */
export const useLiveChatAvailabilityHeartbeat = (
	enabled: boolean,
	active: boolean
): void => {
	useEffect(() => {
		if (!enabled || !active) return;
		let leaseWatchdog = 0;
		// Unmounting (logout above all) ends this session's heartbeat: the
		// request is aborted, and an answer that arrives anyway must not
		// write an acknowledgement, a loss or a timer for a session that is
		// gone — the next consultant would inherit it.
		let disposed = false;
		// One controller per request: fetchData never removes the abort
		// listener it adds, so a shared signal would collect one per beat.
		const inFlight = new Set<AbortController>();
		const armLeaseWatchdog = (
			delay = LIVE_CHAT_LEASE_MS,
			waitedForBeat = false
		) => {
			window.clearTimeout(leaseWatchdog);
			const armedAtRevision = availabilityRevision;
			leaseWatchdog = window.setTimeout(() => {
				// Another tab may still be renewing the lease; the server
				// counts the consultant until a lease after its last ack.
				const leaseLeft = leaseLeftNow();
				if (leaseLeft > 0) armLeaseWatchdog(leaseLeft);
				// The state changed since this was armed (e.g. a second
				// enable while already live, which does not restart this
				// effect). Never stand down: while active, a watchdog is
				// always armed, so judge again after a short window.
				else if (armedAtRevision !== availabilityRevision)
					armLeaseWatchdog(LIVE_CHAT_UNKNOWN_LEASE_MS);
				// A renewal still in flight — this tab's or another's, which
				// this tab cannot see — may be the one that keeps the lease:
				// wait once for as long as a request may take, then read the
				// shared acknowledgement again.
				else if (!waitedForBeat)
					armLeaseWatchdog(LIVE_CHAT_HEARTBEAT_TIMEOUT_MS, true);
				else dropLiveChatAvailability('connectionLost');
			}, delay);
		};
		// The GET that made `active` true only reads whether a lease exists;
		// it does not renew it. So the watchdog counts from the last
		// acknowledgement any tab saw, and one beat goes out at once so a
		// reloaded tab renews the lease instead of waiting a full interval.
		// Without a record younger than a lease (first load after this
		// shipped, or a long-closed session) the remainder is unknown: a
		// failed first renewal must not buy a full lease, so "live" is only
		// claimed for a short window unless a beat or another tab renews it.
		const leaseLeftAtStart = leaseLeftNow();
		let leaseKnown = leaseLeftAtStart > 0;
		armLeaseWatchdog(
			leaseKnown ? leaseLeftAtStart : LIVE_CHAT_UNKNOWN_LEASE_MS
		);
		let firstBeatRetry = 0;
		let firstBeatRetried = false;
		const beat = () => {
			const requestedAtRevision = availabilityRevision;
			const sentAt = Date.now();
			const epoch = readLiveChatSessionEpoch();
			// A torn-down session (logout, auth failure) writes nothing,
			// even when the shell above this hook stays mounted.
			const sessionEnded = () => epoch !== readLiveChatSessionEpoch();
			// A negative answer describes the lease when it was sent. If any
			// tab had an enable or heartbeat acknowledged since, the lease
			// was renewed after that; its storage event may simply not have
			// reached this tab yet, so the tab-local revision cannot tell.
			const sent = markRenewals();
			const renewedSinceSent = () => renewedSince(sent);
			const request = new AbortController();
			inFlight.add(request);
			void apiHeartbeatLiveChatAvailability(request.signal)
				.finally(() => {
					inFlight.delete(request);
				})
				.then((leaseActive) => {
					if (disposed || sessionEnded()) return;
					if (requestedAtRevision !== availabilityRevision) return;
					if (leaseActive) {
						leaseKnown = true;
						recordLiveChatHeartbeatAcknowledged(sentAt);
						// The lease runs from when the renewal was sent.
						armLeaseWatchdog(leaseLeftNow());
					} else if (!renewedSinceSent())
						dropLiveChatAvailability('leaseLost');
				})
				.catch((error: unknown) => {
					if (disposed || sessionEnded()) return;
					if (requestedAtRevision !== availabilityRevision) return;
					if (renewedSinceSent()) return;
					const refusal = heartbeatRefusalReason(error);
					if (refusal) {
						dropLiveChatAvailability(refusal);
						return;
					}
					// Otherwise transient: the next beat is the retry, and the
					// watchdog bounds how long "live" may be claimed without one.
					// An unknown lease cannot wait a full interval for it.
					if (!leaseKnown && !firstBeatRetried) {
						firstBeatRetried = true;
						firstBeatRetry = window.setTimeout(
							beat,
							LIVE_CHAT_FIRST_BEAT_RETRY_MS
						);
					}
				});
		};
		beat();
		const heartbeat = window.setInterval(
			beat,
			LIVE_CHAT_HEARTBEAT_INTERVAL_MS
		);
		return () => {
			disposed = true;
			inFlight.forEach((request) => request.abort());
			inFlight.clear();
			window.clearInterval(heartbeat);
			window.clearTimeout(firstBeatRetry);
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
