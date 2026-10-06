import React, {
	createContext,
	useContext,
	useEffect,
	useMemo,
	useSyncExternalStore,
	type PropsWithChildren
} from 'react';
import {
	endPractice,
	enterPracticeMode,
	getPracticeSnapshot,
	restartPracticeMode,
	subscribePractice
} from './practiceMode';

export interface PracticeContextValue {
	/** `closing`: ended, the practice views unmount, the guard is still on. */
	state: 'inactive' | 'active' | 'closing';
	/** Only while active: the banner and practice-only UI show then. */
	isPractice: boolean;
	tourId: string | null;
	variant: string | null;
	/** Changes on every enter and restart: reset fixtures when it does. */
	runId: number | null;
	/** Installs the network guard, then switches practice on. */
	enter: (params: { tourId: string; variant?: string }) => void;
	/**
	 * Ends practice: the views unmount, drain, then every layer and the guard
	 * come off. Nothing is persisted, nothing to delete.
	 */
	exit: () => Promise<void>;
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
	exit: () => Promise.resolve(),
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

	// Logout and teardown: the practice views below unmount in the same
	// commit, so the guard comes off after they drained. StrictMode's
	// simulated unmount lands here too; entering again cancels that exit.
	useEffect(
		() => () => {
			void endPractice();
		},
		[]
	);

	const value = useMemo<PracticeContextValue>(
		() => ({
			state: snapshot.status,
			isPractice: snapshot.status === 'active',
			tourId: snapshot.session?.tourId ?? null,
			variant: snapshot.session?.variant ?? null,
			runId: snapshot.session?.runId ?? null,
			enter: enterPracticeMode,
			exit: endPractice,
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
