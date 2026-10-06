import React, {
	createContext,
	useContext,
	useEffect,
	useMemo,
	useSyncExternalStore,
	type PropsWithChildren
} from 'react';
import {
	enterPracticeMode,
	exitPracticeMode,
	getPracticeSnapshot,
	restartPracticeMode,
	subscribePractice
} from './practiceMode';

export interface PracticeContextValue {
	state: 'inactive' | 'active';
	isPractice: boolean;
	tourId: string | null;
	variant: string | null;
	/** Changes on every enter and restart: reset fixtures when it does. */
	runId: number | null;
	/** Installs the network guard, then switches practice on. */
	enter: (params: { tourId: string; variant?: string }) => void;
	/** Removes every layer and the guard; nothing is persisted, nothing to delete. */
	exit: () => void;
	/** New run of the same tour. The guard stays on throughout. */
	restart: () => void;
}

const outsideProvider: PracticeContextValue = {
	state: 'inactive',
	isPractice: false,
	tourId: null,
	variant: null,
	runId: null,
	enter: () => {
		throw new Error('usePractice().enter needs a <PracticeProvider>');
	},
	exit: () => undefined,
	restart: () => undefined
};

const PracticeContext = createContext<PracticeContextValue>(outsideProvider);

/** Components outside a provider (stories, tests) simply read "not practising". */
export const usePractice = (): PracticeContextValue =>
	useContext(PracticeContext);

/**
 * React face of the module-level practice mode. Mount it once, above the
 * routes and the providers practice has to rebind. Unmounting it (logout,
 * teardown) ends practice, and with it the guard.
 */
export const PracticeProvider = ({ children }: PropsWithChildren) => {
	const snapshot = useSyncExternalStore(
		subscribePractice,
		getPracticeSnapshot,
		getPracticeSnapshot
	);

	// StrictMode's simulated unmount lands here too; entering again re-installs.
	useEffect(() => () => exitPracticeMode(), []);

	const value = useMemo<PracticeContextValue>(
		() => ({
			state: snapshot.status,
			isPractice: snapshot.status === 'active',
			tourId: snapshot.session?.tourId ?? null,
			variant: snapshot.session?.variant ?? null,
			runId: snapshot.session?.runId ?? null,
			enter: enterPracticeMode,
			exit: exitPracticeMode,
			restart: restartPracticeMode
		}),
		[snapshot]
	);

	return (
		<PracticeContext.Provider value={value}>
			{children}
		</PracticeContext.Provider>
	);
};
