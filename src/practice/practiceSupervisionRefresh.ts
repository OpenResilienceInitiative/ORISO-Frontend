import { useSyncExternalStore } from 'react';
import { isPracticeMode, subscribePractice } from './practiceMode';

/**
 * The case view resolves the supervision side room once, when the case opens
 * (`SessionStream`, `SessionItemComponent`). In practice the learner adds the
 * supervisor under that open case, so the header announces the add here and
 * both lookups run again. Outside practice the revision stays 0: nothing is
 * announced and the lookups keep their open-only behaviour.
 */
let revision = 0;
const listeners = new Set<() => void>();

export const notifyPracticeSupervisorsChanged = (): void => {
	if (!isPracticeMode()) {
		return;
	}
	revision += 1;
	listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void): (() => void) => {
	listeners.add(listener);
	const stopPracticeUpdates = subscribePractice(listener);
	return () => {
		listeners.delete(listener);
		stopPracticeUpdates();
	};
};

const readRevision = (): number => (isPracticeMode() ? revision : 0);

/** Effect dependency that changes when practice added a supervisor; 0 otherwise. */
export const usePracticeSupervisorsRevision = (): number =>
	useSyncExternalStore(subscribe, readRevision, () => 0);
