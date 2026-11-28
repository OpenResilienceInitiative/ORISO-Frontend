import { describe, expect, it } from 'vite-plus/test';
import { canStartPracticeTourInViewport } from './practiceViewport';
import {
	PRACTICE_ACCEPT_TOUR_ID,
	PRACTICE_CALENDAR_TOUR_ID,
	PRACTICE_SUPERVISION_TOUR_ID
} from './practiceTourIds';

describe('canStartPracticeTourInViewport', () => {
	it('needs fromL for every practice flow, and fromXL for supervision', () => {
		const narrow = { fromL: false, fromXL: false };
		const large = { fromL: true, fromXL: false };
		expect(
			canStartPracticeTourInViewport(PRACTICE_ACCEPT_TOUR_ID, narrow)
		).toBe(false);
		expect(
			canStartPracticeTourInViewport(PRACTICE_ACCEPT_TOUR_ID, large)
		).toBe(true);
		expect(
			canStartPracticeTourInViewport(PRACTICE_SUPERVISION_TOUR_ID, large)
		).toBe(false);
	});

	it('starts the Kalender flow only beyond the compact calendar, which has no "Als Nächstes"', () => {
		const large = { fromL: true, fromXL: false };
		expect(
			canStartPracticeTourInViewport(PRACTICE_CALENDAR_TOUR_ID, large)
		).toBe(false);
		expect(
			canStartPracticeTourInViewport(PRACTICE_CALENDAR_TOUR_ID, {
				...large,
				beyondCompactCalendar: false
			})
		).toBe(false);
		expect(
			canStartPracticeTourInViewport(PRACTICE_CALENDAR_TOUR_ID, {
				...large,
				beyondCompactCalendar: true
			})
		).toBe(true);
	});
});
