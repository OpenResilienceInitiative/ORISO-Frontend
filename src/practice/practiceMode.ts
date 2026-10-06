import { endpoints } from '../resources/scripts/endpoints';
import {
	BlockedRequest,
	createNetworkGuard,
	NetworkGuard
} from './networkGuard';
import { runPracticeRestartHandlers } from './practiceRestart';
import { isPracticeTourId } from './practiceTourIds';

/**
 * The practice mode state, in memory only (spec section 4, claim 2): nothing
 * here touches localStorage, sessionStorage or IndexedDB, so a reload, a closed
 * tab or a logout simply ends it. Module level on purpose: api layers and
 * other non-React code ask `isPracticeMode()`, and the guard patches globals
 * of which a page has exactly one set. `PracticeProvider` is the React face.
 *
 * Order matters: the guard goes on BEFORE the mode reports active, and comes
 * off only AFTER the layers on top of it (fake backend, ...) are torn down.
 * The app leaves through `endPractice` (unmount, drain, then exit);
 * `exitPracticeMode` is the immediate exit for a session already torn down.
 */

export interface PracticeSession {
	tourId: string;
	variant?: string;
	/** New for every enter and restart; fixtures reset when it changes. */
	runId: number;
}

/**
 * `closing`: practice has ended for the UI (the practice views unmount), but
 * the guard stays on until the layers on top have drained (`endPractice`).
 */
export type PracticeSnapshot =
	| { status: 'inactive'; session: null }
	| { status: 'active' | 'closing'; session: PracticeSession };

const INACTIVE: PracticeSnapshot = { status: 'inactive', session: null };

let snapshot: PracticeSnapshot = INACTIVE;
let guard: NetworkGuard | null = null;
let lastRunId = 0;
const subscribers = new Set<() => void>();
const blockedListeners = new Set<(request: BlockedRequest) => void>();
let exitTeardowns: Array<() => void> = [];
let closing: Promise<void> | null = null;
/** Bumped by every enter: a pending close of an older run must not exit. */
let epoch = 0;
let exitHolds = 0;
const holdListeners = new Set<() => void>();
const notifyHoldListeners = () =>
	holdListeners.forEach((listener) => listener());

const publish = (next: PracticeSnapshot) => {
	snapshot = next;
	subscribers.forEach((listener) => {
		try {
			listener();
		} catch (_error) {
			// A broken subscriber must not break enter, exit or the others.
		}
	});
};

/** True while the guard is on: active, and while closing. */
export const isPracticeMode = (): boolean => snapshot.status !== 'inactive';

/** Same object until the state changes, as `useSyncExternalStore` requires. */
export const getPracticeSnapshot = (): PracticeSnapshot => snapshot;

export const subscribePractice = (listener: () => void): (() => void) => {
	subscribers.add(listener);
	return () => {
		subscribers.delete(listener);
	};
};

/** Test hook and banner source: counts and blocked requests of the running guard. */
export const getPracticeNetworkGuard = (): NetworkGuard | null => guard;

export const onPracticeBlocked = (
	listener: (request: BlockedRequest) => void
): (() => void) => {
	blockedListeners.add(listener);
	return () => {
		blockedListeners.delete(listener);
	};
};

/**
 * For layers installed on top of the guard (fake backend, Matrix rebinding):
 * `exitPracticeMode` runs the teardowns newest first, then removes the guard.
 */
export const onPracticeExit = (teardown: () => void): (() => void) => {
	if (!isPracticeMode()) {
		throw new Error('onPracticeExit needs an active practice session');
	}
	exitTeardowns.push(teardown);
	return () => {
		exitTeardowns = exitTeardowns.filter((entry) => entry !== teardown);
	};
};

export const enterPracticeMode = ({
	tourId,
	variant
}: {
	tourId: string;
	variant?: string;
}): void => {
	if (!isPracticeTourId(tourId)) {
		throw new Error(`Not a practice tour: ${JSON.stringify(tourId)}`);
	}
	const isNewRunOnRunningGuard = !!guard;
	if (guard) {
		// Already running: stay in the same guard so layers on top keep their place.
		guard.setAllowedTourIds([tourId]);
	} else {
		const next = createNetworkGuard({
			allowedTourIds: [tourId],
			tutorialProgressUrl: endpoints.tutorialProgress,
			tokenRefreshUrl: endpoints.keycloakAccessToken,
			onBlocked: (request) =>
				blockedListeners.forEach((listener) => listener(request))
		});
		next.install();
		guard = next;
	}
	// Re-entering while closing (restart = end + enter) cancels that exit.
	epoch += 1;
	closing = null;
	notifyHoldListeners();
	publish({
		status: 'active',
		session: { tourId, variant, runId: ++lastRunId }
	});
	if (isNewRunOnRunningGuard) {
		// Mounted layers keep their state otherwise; a fresh run needs fresh fixtures.
		runPracticeRestartHandlers();
	}
};

export const restartPracticeMode = (): void => {
	if (snapshot.status !== 'active') {
		return;
	}
	publish({
		status: 'active',
		session: { ...snapshot.session, runId: ++lastRunId }
	});
	runPracticeRestartHandlers();
};

export const exitPracticeMode = (): void => {
	if (snapshot.status !== 'active' && !guard) {
		return;
	}
	const teardowns = exitTeardowns.reverse();
	exitTeardowns = [];
	try {
		teardowns.forEach((teardown) => {
			try {
				teardown();
			} catch (_error) {
				// One broken layer must not keep the guard on or the others up.
			}
		});
	} finally {
		guard?.uninstall();
		guard = null;
		publish(INACTIVE);
	}
};

/**
 * For layers that must be gone before the guard comes off (the sandbox: its
 * unmount drains practice requests a macrotask later). `endPractice` waits
 * until every hold is released. The returned release is idempotent.
 */
export const holdPracticeExit = (): (() => void) => {
	exitHolds += 1;
	let released = false;
	return () => {
		if (released) return;
		released = true;
		exitHolds -= 1;
		notifyHoldListeners();
	};
};

const nextMacrotask = () =>
	new Promise<void>((resolve) => {
		window.setTimeout(resolve, 0);
	});

/**
 * A drain takes one macrotask plus the practice requests still in flight.
 * Past this, a layer that never lets go must not keep logout or the tab in
 * "closing" forever.
 */
export const PRACTICE_DRAIN_TIMEOUT_MS = 2000;

/** Resolves once no layer holds the exit, once a newer run started, or on timeout. */
const whenHoldsReleased = (token: number) =>
	new Promise<void>((resolve) => {
		let timer = 0;
		const done = () => {
			window.clearTimeout(timer);
			holdListeners.delete(check);
			resolve();
		};
		function check() {
			if (exitHolds === 0 || token !== epoch) done();
		}
		timer = window.setTimeout(done, PRACTICE_DRAIN_TIMEOUT_MS);
		holdListeners.add(check);
		check();
	});

/**
 * The one way out for the app (banner End, tour end, logout, provider
 * unmount): `closing` first, so the practice views unmount while the guard is
 * still on; the guard comes off only after they drained. Idempotent: every
 * caller gets the same promise, resolved once practice is off.
 */
export const endPractice = (): Promise<void> => {
	if (closing) {
		return closing;
	}
	if (snapshot.status !== 'active') {
		return Promise.resolve();
	}
	const token = epoch;
	publish({ status: 'closing', session: snapshot.session });
	const pending = nextMacrotask()
		.then(() => whenHoldsReleased(token))
		.then(() => {
			if (token !== epoch) return;
			closing = null;
			exitPracticeMode();
		});
	closing = pending;
	return pending;
};
