import type { TourDefinition } from '../components/productTour/types';

/**
 * TEMPORARY STUB, delete when S5/S6 merge (`practiceTours.ts` exports the real
 * `practiceTours: TourDefinition[]`). The integrator points
 * `practiceToursSource.ts` at `./practiceTours` and removes this file. Only the
 * ids are contract (`PRACTICE_TOUR_IDS`); titles and steps are placeholders so
 * the cards, banner and host can be built and tested without S5/S6.
 */
export const practiceTours: TourDefinition[] = [
	{
		id: 'consultant-practice-accept',
		version: 1,
		surface: 'frontend',
		audiences: ['consultant'],
		titleKey: 'tour.practice.accept.title',
		summaryKey: 'tour.practice.accept.summary',
		dismissible: false,
		steps: [
			{
				id: 'stub',
				target: '',
				titleKey: 'tour.practice.accept.title',
				contentKey: 'tour.practice.accept.summary'
			}
		]
	},
	{
		id: 'consultant-practice-supervision',
		version: 1,
		surface: 'frontend',
		audiences: ['consultant'],
		titleKey: 'tour.practice.supervision.title',
		summaryKey: 'tour.practice.supervision.summary',
		dismissible: false,
		steps: [
			{
				id: 'stub',
				target: '',
				titleKey: 'tour.practice.supervision.title',
				contentKey: 'tour.practice.supervision.summary'
			}
		]
	}
];
