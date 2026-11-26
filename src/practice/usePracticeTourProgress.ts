import { useCallback, useEffect } from 'react';
import { atom, useAtomValue, useSetAtom } from 'jotai';
import type {
	TourDefinition,
	TourEvent,
	TourStep
} from '../components/productTour/types';
import { isPracticeTourId } from './practiceTourIds';

export interface PracticeTourProgress {
	tourId: string;
	/** Zero-based index into the resolved steps. */
	stepIndex: number;
	/** The resolved step count of this run (variants applied). */
	stepCount: number;
	/** Id of the step on screen; unset until the run shows one. */
	stepId?: string;
}

/** What the banner shows as "Step i of N"; null while no practice run mounts. */
export const practiceTourProgressAtom = atom(
	null as PracticeTourProgress | null
);

export const usePracticeTourProgress = (): PracticeTourProgress | null =>
	useAtomValue(practiceTourProgressAtom);

/** Whether the practice run of `tourId` is on its step `stepId`. */
export const usePracticeTourAtStep = (
	tourId: string,
	stepId: string
): boolean => {
	const progress = usePracticeTourProgress();
	return progress?.tourId === tourId && progress.stepId === stepId;
};

/**
 * For the tour host: call the returned function from the adapter's `onEvent`.
 * The run counts as step 1 once it mounts, `step_viewed` moves it, and the
 * progress is forgotten when the run unmounts. `tour` must be the resolved
 * tour the adapter runs, so the count matches what the user walks through.
 */
export const usePracticeTourProgressReporter = (
	tour: TourDefinition | undefined
): ((event: TourEvent, step?: TourStep) => void) => {
	const setProgress = useSetAtom(practiceTourProgressAtom);
	const isPractice =
		!!tour && isPracticeTourId(tour.id) && tour.steps.length > 0;

	useEffect(() => {
		if (!tour || !isPractice) {
			return undefined;
		}
		setProgress({
			tourId: tour.id,
			stepIndex: 0,
			stepCount: tour.steps.length,
			stepId: tour.steps[0].id
		});
		return () => setProgress(null);
	}, [isPractice, setProgress, tour]);

	return useCallback(
		(event: TourEvent, step?: TourStep) => {
			if (!tour || !isPractice || !step) {
				return;
			}
			if (event === 'step_completed') {
				// Left by Next: no step is on screen until the next one shows.
				setProgress((progress) =>
					progress?.tourId === tour.id && progress.stepId === step.id
						? { ...progress, stepId: undefined }
						: progress
				);
				return;
			}
			if (event !== 'step_viewed') {
				return;
			}
			const stepIndex = tour.steps.findIndex(
				(candidate) => candidate.id === step.id
			);
			if (stepIndex >= 0) {
				setProgress({
					tourId: tour.id,
					stepIndex,
					stepCount: tour.steps.length,
					stepId: step.id
				});
			}
		},
		[isPractice, setProgress, tour]
	);
};
