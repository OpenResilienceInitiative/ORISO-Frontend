import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_METHODS, FETCH_SUCCESS } from './fetchData';

export type TutorialProgressStatus =
	| 'not_started'
	| 'in_progress'
	| 'completed'
	| 'skipped';

export interface ITutorialProgressItem {
	tourId: string;
	tourVersion: number;
	surface: 'frontend' | 'admin';
	status: TutorialProgressStatus;
	currentStepId?: string | null;
	startedAt?: string | null;
	completedAt?: string | null;
}

export interface IUpsertTutorialProgressRequest {
	surface: 'frontend' | 'admin';
	tourId: string;
	tourVersion: number;
	status: TutorialProgressStatus;
	currentStepId?: string;
}

export const apiGetTutorialProgress = async (
	surface: 'frontend' | 'admin'
): Promise<ITutorialProgressItem[]> =>
	fetchData({
		url: `${endpoints.tutorialProgress}?surface=${surface}`,
		method: FETCH_METHODS.GET,
		responseHandling: [FETCH_SUCCESS.CONTENT]
	});

/**
 * Upserts the caller's own versioned tutorial progress. Failures reject so
 * the UI never reports a completion the server has not accepted.
 */
export const apiUpsertTutorialProgress = async (
	request: IUpsertTutorialProgressRequest
): Promise<ITutorialProgressItem> =>
	fetchData({
		url: endpoints.tutorialProgress,
		method: FETCH_METHODS.PUT,
		bodyData: JSON.stringify(request),
		responseHandling: [FETCH_SUCCESS.CONTENT]
	});
