import * as React from 'react';
import { useEffect } from 'react';
import i18n from 'i18next';
import { M3Snackbar } from '../components/m3Snackbar/M3Snackbar';
import { appSnackbarStack } from '../components/m3Snackbar/snackbarStack';
import { registerTourHostHooks } from '../components/productTour/tourHostHooks';
import { endPractice, enterPracticeMode } from './practiceMode';
import { PRACTICE_TOUR_IDS } from './practiceTourIds';

const START_ERROR_MS = 8000;

const announceStartFailed = () => {
	const message = i18n.t('practice.error.start');
	appSnackbarStack.enqueue({
		// One entry however often the start is retried.
		id: 'practice-start-failed',
		announcement: message,
		autoHideDuration: START_ERROR_MS,
		render: ({ dismiss }) => (
			<M3Snackbar
				placement="inline"
				role="status"
				message={message}
				onClose={dismiss}
				closeLabel={i18n.t('app.close')}
				sx={{ maxWidth: 'none' }}
			/>
		)
	});
};

/**
 * Hooks the tour host runs around a practice tour (`Walkthrough` hands them to
 * the adapter): practice mode, and with it the network guard, is on before the
 * first step is prepared, and it ends with the tour, however it ends, through
 * the drained exit. A restart remounts the run: its enter cancels that exit.
 *
 * A failing `setup` means no tour starts: the adapter never prepares a step
 * and still calls `teardown`, which is safe without an active session.
 */
export const registerPracticeTourHostHooks = (): (() => void) => {
	const unregister = PRACTICE_TOUR_IDS.map((tourId) =>
		registerTourHostHooks(tourId, {
			setup: () => {
				try {
					enterPracticeMode({ tourId });
				} catch (error) {
					announceStartFailed();
					throw error;
				}
			},
			teardown: () => {
				void endPractice();
			}
		})
	);
	return () => unregister.forEach((remove) => remove());
};

/** Mount once in the authenticated app, below `PracticeProvider`. */
export const PracticeHostHooks = (): null => {
	useEffect(() => registerPracticeTourHostHooks(), []);
	return null;
};
