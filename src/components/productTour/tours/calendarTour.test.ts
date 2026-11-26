import { describe, expect, it } from 'vite-plus/test';
import { CALENDAR_TOUR_VERSION, consultantCalendarTour } from './calendarTour';
import { itKeepsTheTourContract } from './tourDefinitionContract.testkit';

describe('consultant-calendar', () => {
	itKeepsTheTourContract(
		consultantCalendarTour,
		'consultant',
		CALENDAR_TOUR_VERSION
	);

	it('is version 2: the practice rendering (FE#2545) shares id and version', () => {
		expect(CALENDAR_TOUR_VERSION).toBe(2);
	});

	const steps = consultantCalendarTour.steps;

	it('starts on the nav item and ends on the links box', () => {
		expect(steps.map((step) => step.target)).toEqual([
			'nav-calendar',
			'calendar-create',
			'calendar-view-switch',
			'calendar-quick-entry',
			'calendar-working-hours',
			'calendar-settings',
			'calendar-links'
		]);
	});

	it('stays on the calendar page', () => {
		steps.forEach((step) => expect(step.route).toBe('/booking/events'));
	});

	it('makes the desktop sidebar and list-only steps optional', () => {
		expect(
			steps.filter((step) => step.optional).map((step) => step.id)
		).toEqual(['quick-entry', 'working-hours', 'links']);
	});
});
