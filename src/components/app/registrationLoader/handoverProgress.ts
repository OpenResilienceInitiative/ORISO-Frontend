import { useSyncExternalStore } from 'react';

/**
 * The real work between "Registrieren" and the message field, in the order it
 * happens. The gate's fill is the share of these that is finished — no timer,
 * no estimate (Frank, 2026-10-15: "wenn die Sachen geladen sind, dann sind sie
 * halt geladen"; ORISO-Frontend#1219).
 *
 * The first three happen on the registration document, the rest on the app
 * document after the load that lets browsers offer to save the password
 * (#1208). The finished set is kept in sessionStorage so the second document
 * starts where the first stopped instead of at zero.
 */
export const HANDOVER_MILESTONES = [
	/** The account exists. */
	'account',
	/** Auto-login has tokens. */
	'signedIn',
	/** The new enquiry's session is known, so the click can open it. */
	'sessions',
	/** Token refresh, profile and consulting types. */
	'profile',
	/** Matrix client and its crypto are up. */
	'chat',
	/** Live events are wired. */
	'liveEvents',
	/** The screens behind the button (session, enquiry) are loaded. */
	'screens'
] as const;

export type HandoverMilestone = (typeof HANDOVER_MILESTONES)[number];

export const HANDOVER_PROGRESS_KEY = 'oriso.handoverProgress';

const isMilestone = (value: unknown): value is HandoverMilestone =>
	HANDOVER_MILESTONES.includes(value as HandoverMilestone);

const read = (): Set<HandoverMilestone> => {
	try {
		const stored = JSON.parse(
			sessionStorage.getItem(HANDOVER_PROGRESS_KEY) ?? '[]'
		);
		return new Set(Array.isArray(stored) ? stored.filter(isMilestone) : []);
	} catch {
		return new Set();
	}
};

const write = (done: Set<HandoverMilestone>) => {
	try {
		if (done.size === 0) {
			sessionStorage.removeItem(HANDOVER_PROGRESS_KEY);
		} else {
			sessionStorage.setItem(
				HANDOVER_PROGRESS_KEY,
				JSON.stringify(Array.from(done))
			);
		}
	} catch {
		/* Storage refused: the fill restarts lower on the app document. */
	}
};

let done = read();
let snapshot = 0;
const listeners = new Set<() => void>();

const publish = () => {
	snapshot = Math.round((done.size / HANDOVER_MILESTONES.length) * 100);
	write(done);
	listeners.forEach((listener) => listener());
};
snapshot = Math.round((done.size / HANDOVER_MILESTONES.length) * 100);

export const markHandoverMilestone = (milestone: HandoverMilestone) => {
	if (done.has(milestone)) return;
	done = new Set(done).add(milestone);
	publish();
};

/** A new submit, a failed one, or the handover is over. */
export const resetHandoverProgress = () => {
	if (done.size === 0) return;
	done = new Set();
	publish();
};

/** 0–100: the share of milestones that is finished. */
export const getHandoverProgress = () => snapshot;

export const subscribeHandoverProgress = (listener: () => void) => {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
};

export const useHandoverProgress = () =>
	useSyncExternalStore(
		subscribeHandoverProgress,
		getHandoverProgress,
		getHandoverProgress
	);

/** Test seam: re-read storage as a fresh document would. */
export const reloadHandoverProgressForTests = () => {
	done = read();
	snapshot = Math.round((done.size / HANDOVER_MILESTONES.length) * 100);
};
