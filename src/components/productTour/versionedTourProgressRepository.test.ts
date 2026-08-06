import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	apiGetTutorialProgress,
	apiUpsertTutorialProgress
} from '../../api/apiTutorialProgress';
import { versionedTourProgressRepository } from './versionedTourProgressRepository';

vi.mock('../../api/apiTutorialProgress', () => ({
	apiGetTutorialProgress: vi.fn(() => Promise.resolve([])),
	apiUpsertTutorialProgress: vi.fn(() => Promise.resolve({}))
}));

afterEach(() => {
	vi.clearAllMocks();
});

describe('versionedTourProgressRepository', () => {
	it('persists progress through the versioned userservice api', async () => {
		await versionedTourProgressRepository.saveProgress({
			tourId: 'consultant-walkthrough',
			tourVersion: 1,
			status: 'in_progress',
			currentStepId: 'enquiries'
		});

		expect(apiUpsertTutorialProgress).toHaveBeenCalledWith({
			surface: 'frontend',
			tourId: 'consultant-walkthrough',
			tourVersion: 1,
			status: 'in_progress',
			currentStepId: 'enquiries'
		});
	});

	it('reads the frontend-surface progress list', async () => {
		vi.mocked(apiGetTutorialProgress).mockResolvedValueOnce([
			{
				tourId: 'consultant-walkthrough',
				tourVersion: 1,
				surface: 'frontend',
				status: 'completed'
			} as any
		]);

		const items = await versionedTourProgressRepository.getProgress();

		expect(apiGetTutorialProgress).toHaveBeenCalledWith('frontend');
		expect(items[0]).toMatchObject({
			tourId: 'consultant-walkthrough',
			tourVersion: 1,
			status: 'completed'
		});
	});

	it('rejects on write failure instead of swallowing it', async () => {
		vi.mocked(apiUpsertTutorialProgress).mockRejectedValueOnce(
			new Error('offline')
		);

		await expect(
			versionedTourProgressRepository.saveProgress({
				tourId: 'consultant-walkthrough',
				tourVersion: 1,
				status: 'completed'
			})
		).rejects.toThrow('offline');
	});
});
