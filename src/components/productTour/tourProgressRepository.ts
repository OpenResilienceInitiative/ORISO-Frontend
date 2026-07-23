import { apiPatchConsultantData } from '../../api';
import type { TourProgress } from './types';

export interface TourProgressRepository {
	/**
	 * Persists tour progress. Rejects on write failure so callers never
	 * report a completion the server has not accepted.
	 */
	saveProgress(progress: TourProgress): Promise<void>;
}

/**
 * Compatibility repository for the existing UserService walkthrough boolean.
 * The boolean can only express enabled/disabled, so terminal states disable
 * the walkthrough and non-terminal progress is not persisted. Replaced by the
 * versioned progress API in a later delivery package (TOUR-03/TOUR-04).
 */
export const legacyWalkthroughProgressRepository: TourProgressRepository = {
	async saveProgress(progress: TourProgress): Promise<void> {
		if (progress.status !== 'completed' && progress.status !== 'skipped') {
			return;
		}
		await apiPatchConsultantData({ walkThroughEnabled: false });
	}
};
