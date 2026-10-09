import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	apiGetTutorialProgress,
	apiUpsertTutorialProgress
} from '../../api/apiTutorialProgress';
import { versionedTourProgressRepository } from './versionedTourProgressRepository';
import { getValueFromCookie } from '../sessionCookie/accessSessionCookie';

vi.mock('../sessionCookie/accessSessionCookie', () => ({
	getValueFromCookie: vi.fn(() => '')
}));

vi.mock('../../api/apiTutorialProgress', () => ({
	apiGetTutorialProgress: vi.fn(() => Promise.resolve([])),
	apiUpsertTutorialProgress: vi.fn(() => Promise.resolve({}))
}));

afterEach(() => {
	vi.clearAllMocks();
	vi.mocked(getValueFromCookie).mockReturnValue('');
});

describe('versionedTourProgressRepository', () => {
	it('does not dispatch an earlier queued reset for a different login', async () => {
		let finishStep!: () => void;
		vi.mocked(apiUpsertTutorialProgress).mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					finishStep = () => resolve({} as any);
				})
		);
		const scope = { tourId: 'consultant-practice-accept', tourVersion: 1 };
		const step = versionedTourProgressRepository.saveProgress({
			...scope,
			status: 'in_progress'
		});
		const reset = versionedTourProgressRepository.saveProgress({
			...scope,
			status: 'not_started'
		});
		const rejected = expect(reset).rejects.toThrow('previous login');
		vi.mocked(getValueFromCookie).mockReturnValue('other-login');
		finishStep();
		await step;
		await rejected;
		expect(apiUpsertTutorialProgress).toHaveBeenCalledTimes(1);
	});
	it('orders a practice reset after an outstanding step write', async () => {
		let finishStep!: () => void;
		vi.mocked(apiUpsertTutorialProgress).mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					finishStep = () => resolve({} as any);
				})
		);
		const scope = { tourId: 'consultant-practice-accept', tourVersion: 1 };
		const step = versionedTourProgressRepository.saveProgress({
			...scope,
			status: 'in_progress',
			currentStepId: 'accept'
		});
		const reset = versionedTourProgressRepository.saveProgress({
			...scope,
			status: 'not_started'
		});
		await Promise.resolve();
		expect(apiUpsertTutorialProgress).toHaveBeenCalledTimes(1);
		finishStep();
		await Promise.all([step, reset]);
		expect(apiUpsertTutorialProgress).toHaveBeenLastCalledWith({
			surface: 'frontend',
			...scope,
			status: 'not_started',
			currentStepId: undefined
		});
	});

	it('still writes a practice reset after the previous save rejects', async () => {
		vi.mocked(apiUpsertTutorialProgress).mockRejectedValueOnce(
			new Error('offline')
		);
		const scope = { tourId: 'consultant-practice-accept', tourVersion: 1 };
		const step = versionedTourProgressRepository.saveProgress({
			...scope,
			status: 'in_progress'
		});
		const rejection = expect(step).rejects.toThrow('offline');
		const reset = versionedTourProgressRepository.saveProgress({
			...scope,
			status: 'not_started'
		});
		await rejection;
		await reset;
		expect(apiUpsertTutorialProgress).toHaveBeenLastCalledWith(
			expect.objectContaining({ status: 'not_started' })
		);
	});
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
