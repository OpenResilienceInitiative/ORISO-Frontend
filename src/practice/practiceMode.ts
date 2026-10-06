import { endpoints } from '../resources/scripts/endpoints';
import {
	BlockedRequest,
	createNetworkGuard,
	NetworkGuard
} from './networkGuard';
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
 */

export interface PracticeSession {
	tourId: string;
	variant?: string;
	/** New for every enter and restart; fixtures reset when it changes. */
	runId: number;
}

export type PracticeSnapshot =
	| { status: 'inactive'; session: null }
	| { status: 'active'; session: PracticeSession };

const INACTIVE: PracticeSnapshot = { status: 'inactive', session: null };

let snapshot: PracticeSnapshot = INACTIVE;
let guard: NetworkGuard | null = null;
let lastRunId = 0;
const subscribers = new Set<() => void>();
const blockedListeners = new Set<(request: BlockedRequest) => void>();
let exitTeardowns: Array<() => void> = [];

const publish = (next: PracticeSnapshot) => {
	snapshot = next;
	subscribers.forEach((listener) => listener());
};

export const isPracticeMode = (): boolean => snapshot.status === 'active';

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
	publish({
		status: 'active',
		session: { tourId, variant, runId: ++lastRunId }
	});
};

export const restartPracticeMode = (): void => {
	if (snapshot.status !== 'active') {
		return;
	}
	publish({
		status: 'active',
		session: { ...snapshot.session, runId: ++lastRunId }
	});
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
