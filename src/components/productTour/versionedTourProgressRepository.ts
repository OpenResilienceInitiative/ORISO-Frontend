import {
	apiGetTutorialProgress,
	apiUpsertTutorialProgress,
	ITutorialProgressItem
} from '../../api/apiTutorialProgress';
import type { TourProgress } from './types';
import { isPracticeTourId } from '../../practice/practiceTourIds';
import { getValueFromCookie } from '../sessionCookie/accessSessionCookie';
import { parseJwt } from '../../utils/parseJWT';

// A late step save must not overwrite an explicit practice cancellation.
const practiceWrites = new Map<string, Promise<void>>();

const practiceWriteIdentity = (): string => {
	const token = getValueFromCookie('keycloak');
	const claims = token ? parseJwt(token) : {};
	return claims.sub
		? JSON.stringify([claims.iss, claims.sub, claims.tenantId])
		: token;
};

export interface VersionedTourProgressRepository {
	/**
	 * Persists tour progress through the versioned UserService API. Rejects
	 * on write failure so callers never report an unaccepted completion.
	 */
	saveProgress(progress: TourProgress): Promise<void>;
	getProgress(): Promise<ITutorialProgressItem[]>;
}

/** Frontend-surface repository backed by /users/tutorials/progress (TOUR-03). */
export const versionedTourProgressRepository: VersionedTourProgressRepository =
	{
		async saveProgress(progress: TourProgress): Promise<void> {
			const isPractice = isPracticeTourId(progress.tourId);
			const identity = isPractice ? practiceWriteIdentity() : undefined;
			const write = async () => {
				if (isPractice && identity !== practiceWriteIdentity()) {
					throw new Error(
						'Practice progress belongs to a previous login'
					);
				}
				await apiUpsertTutorialProgress({
					surface: 'frontend',
					tourId: progress.tourId,
					tourVersion: progress.tourVersion,
					status: progress.status,
					currentStepId: progress.currentStepId
				});
			};
			if (!isPractice) {
				await write();
				return;
			}
			const key = `${identity}:${progress.tourId}:${progress.tourVersion}`;
			const previous = practiceWrites.get(key);
			const pending = previous ? previous.then(write, write) : write();
			practiceWrites.set(key, pending);
			try {
				await pending;
			} finally {
				if (practiceWrites.get(key) === pending)
					practiceWrites.delete(key);
			}
		},
		async getProgress(): Promise<ITutorialProgressItem[]> {
			return apiGetTutorialProgress('frontend');
		}
	};
