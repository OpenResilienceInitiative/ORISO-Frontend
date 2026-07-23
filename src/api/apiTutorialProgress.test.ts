// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	apiGetTutorialProgress,
	apiUpsertTutorialProgress
} from './apiTutorialProgress';
import { fetchData } from './fetchData';

vi.mock('./fetchData', async () => {
	const actual: any = await vi.importActual('./fetchData');
	return {
		...actual,
		fetchData: vi.fn(() => Promise.resolve([]))
	};
});

afterEach(() => {
	vi.clearAllMocks();
});

describe('apiTutorialProgress', () => {
	it('reads the own progress list for a surface', async () => {
		await apiGetTutorialProgress('frontend');

		const call = vi.mocked(fetchData).mock.calls[0][0] as any;
		expect(call.url).toContain('/service/users/tutorials/progress');
		expect(call.url).toContain('surface=frontend');
		expect(call.method).toBe('GET');
	});

	it('upserts progress with the versioned scope payload', async () => {
		vi.mocked(fetchData).mockResolvedValueOnce({ status: 'completed' });

		await apiUpsertTutorialProgress({
			surface: 'frontend',
			tourId: 'consultant-walkthrough',
			tourVersion: 1,
			status: 'completed',
			currentStepId: 'profile'
		});

		const call = vi.mocked(fetchData).mock.calls[0][0] as any;
		expect(call.url).toContain('/service/users/tutorials/progress');
		expect(call.method).toBe('PUT');
		expect(JSON.parse(call.bodyData)).toMatchObject({
			surface: 'frontend',
			tourId: 'consultant-walkthrough',
			tourVersion: 1,
			status: 'completed'
		});
	});

	it('propagates upsert failures so callers never fake completion', async () => {
		vi.mocked(fetchData).mockRejectedValueOnce(new Error('down'));

		await expect(
			apiUpsertTutorialProgress({
				surface: 'frontend',
				tourId: 'consultant-walkthrough',
				tourVersion: 1,
				status: 'completed'
			})
		).rejects.toThrow('down');
	});
});
