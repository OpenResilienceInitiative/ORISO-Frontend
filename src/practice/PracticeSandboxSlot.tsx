import React, {
	useContext,
	useLayoutEffect,
	type PropsWithChildren
} from 'react';
import { UserDataContext } from '../globalState/context/UserDataContext';
import type { PracticeStart } from './fixtures/practiceScenario';
import { PracticeSandbox, usePracticeSandbox } from './PracticeSandbox';
import { usePractice } from './PracticeProvider';
import { registerPracticeRestartHandler } from './practiceRestart';
import { PRACTICE_TOUR_IDS } from './practiceTourIds';

const [, SUPERVISION_TOUR_ID] = PRACTICE_TOUR_IDS;

/** F2 starts on the already accepted case, F1 on the open enquiry. */
const startOf = (tourId: string | null): PracticeStart =>
	tourId === SUPERVISION_TOUR_ID ? 'acceptedCase' : 'enquiry';

/** A new run on the running guard (restart) gets fresh fixtures. */
const RestartOnNewRun = () => {
	const { restart } = usePracticeSandbox();
	// Layout effect: registered before the tour host's passive effects re-enter.
	useLayoutEffect(() => registerPracticeRestartHandler(restart), [restart]);
	return null;
};

/**
 * Puts the routed content onto the practice world: fake REST backend, fake
 * Matrix service, fixtures for the running tour, the real counsellor's
 * identity. `PracticeSurface` mounts it only while practice is active, so it
 * always sits on top of the guard.
 */
export const PracticeSandboxSlot = ({ children }: PropsWithChildren) => {
	const { userData } = useContext(UserDataContext);
	const { tourId } = usePractice();
	return (
		// Another tour needs another start state, not a reset of this one.
		<PracticeSandbox
			key={tourId ?? ''}
			counsellor={userData}
			start={startOf(tourId)}
		>
			<RestartOnNewRun />
			{children}
		</PracticeSandbox>
	);
};
