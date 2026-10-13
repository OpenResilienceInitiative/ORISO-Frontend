import { afterEach, describe, expect, it, vi } from 'vitest';
import { nextPracticeLaunchRequest } from './practiceLaunch';

afterEach(() => vi.restoreAllMocks());

describe('nextPracticeLaunchRequest', () => {
	it('requests the tour in the given mode, stamped with the clock', () => {
		vi.spyOn(Date, 'now').mockReturnValue(5000);

		expect(
			nextPracticeLaunchRequest(
				'consultant-practice-accept',
				'start',
				null
			)
		).toEqual({
			tourId: 'consultant-practice-accept',
			mode: 'start',
			requestedAt: 5000
		});
	});

	it('never repeats or goes back before the previous request, so the host remounts the run', () => {
		vi.spyOn(Date, 'now').mockReturnValue(5000);

		const request = nextPracticeLaunchRequest(
			'consultant-practice-accept',
			'restart',
			{
				tourId: 'consultant-practice-accept',
				mode: 'start',
				requestedAt: 5000
			}
		);

		expect(request.requestedAt).toBe(5001);
	});
});
