import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiPatchConsultantData } from '../../api';
import { legacyWalkthroughProgressRepository } from './tourProgressRepository';

vi.mock('../../api', () => ({
	apiPatchConsultantData: vi.fn(() => Promise.resolve())
}));

afterEach(() => {
	vi.clearAllMocks();
});

describe('legacyWalkthroughProgressRepository', () => {
	it('persists a terminal status by disabling the legacy walkthrough boolean', async () => {
		await legacyWalkthroughProgressRepository.saveProgress({
			tourId: 'consultant-walkthrough',
			tourVersion: 1,
			status: 'completed'
		});

		expect(apiPatchConsultantData).toHaveBeenCalledWith({
			walkThroughEnabled: false
		});
	});

	it('persists skipped the same way — the boolean cannot distinguish outcomes', async () => {
		await legacyWalkthroughProgressRepository.saveProgress({
			tourId: 'consultant-walkthrough',
			tourVersion: 1,
			status: 'skipped'
		});

		expect(apiPatchConsultantData).toHaveBeenCalledWith({
			walkThroughEnabled: false
		});
	});

	it('does not write for non-terminal progress', async () => {
		await legacyWalkthroughProgressRepository.saveProgress({
			tourId: 'consultant-walkthrough',
			tourVersion: 1,
			status: 'in_progress',
			currentStepId: 'enquiries'
		});

		expect(apiPatchConsultantData).not.toHaveBeenCalled();
	});

	it('propagates a failed write instead of swallowing it', async () => {
		vi.mocked(apiPatchConsultantData).mockRejectedValueOnce(
			new Error('network down')
		);

		await expect(
			legacyWalkthroughProgressRepository.saveProgress({
				tourId: 'consultant-walkthrough',
				tourVersion: 1,
				status: 'completed'
			})
		).rejects.toThrow('network down');
	});
});
