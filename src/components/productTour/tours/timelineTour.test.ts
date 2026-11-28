import { describe, expect, it } from 'vite-plus/test';
import { getAvailableTours } from '../tourCatalogue';
import { frontendTopicTours } from '../tourDefinitions';
import { consultantTimelineTour, TIMELINE_TOUR_VERSION } from './timelineTour';
import { itKeepsTheTourContract } from './tourDefinitionContract.testkit';

describe('consultant-timeline', () => {
	itKeepsTheTourContract(
		consultantTimelineTour,
		'consultant',
		TIMELINE_TOUR_VERSION
	);

	it('is version 2: the practice rendering (FE#2545) shares id and version', () => {
		expect(TIMELINE_TOUR_VERSION).toBe(2);
	});

	it('walks the timeline first, then the drafts', () => {
		expect(consultantTimelineTour.steps.map((step) => step.id)).toEqual([
			'activity-nav',
			'timeline',
			'filters',
			'mark-all-read',
			'drafts-chip',
			'drafts-center'
		]);
		expect(consultantTimelineTour.steps.at(-1)?.route).toBe('/drafts');
	});

	it('makes only the content- and layout-dependent steps optional', () => {
		expect(
			consultantTimelineTour.steps
				.filter((step) => step.optional)
				.map((step) => step.id)
		).toEqual(['filters', 'mark-all-read', 'drafts-chip']);
	});

	it('targets anchors that exist on a fresh account for its mandatory steps', () => {
		expect(
			consultantTimelineTour.steps
				.filter((step) => !step.optional)
				.map((step) => step.target)
		).toEqual(['nav-activity', 'timeline-page', 'drafts-center']);
	});

	it('is offered to every counsellor, never to askers', () => {
		expect(
			getAvailableTours([consultantTimelineTour], 'consultant', {
				flags: {}
			})
		).toEqual([consultantTimelineTour]);
		expect(
			getAvailableTours([consultantTimelineTour], 'asker', { flags: {} })
		).toEqual([]);
	});

	it('is registered as a topic tour', () => {
		expect(frontendTopicTours).toContain(consultantTimelineTour);
	});
});
