import { isTourAvailable } from '../components/productTour/tourEngine';
import type {
	TourCondition,
	TourDefinition
} from '../components/productTour/types';

/**
 * Tenant gates a practice tour needs regardless of what its definition says:
 * the Supervision card is hidden, not greyed (spec D10), and a one-on-one
 * practice case only has the "+" when one-on-one supervision is on too.
 */
const PRACTICE_TOUR_GATES: Record<string, TourCondition[]> = {
	'consultant-practice-supervision': [
		{ flag: 'featureSupervisionEnabled' },
		{ flag: 'featureSupervisionOneOnOneChatsEnabled' }
	]
};

/**
 * Unset tenant flags count as on (`!== false`, the app-wide convention).
 * `flags` is the tenant's settings, read reactively by the caller.
 */
export const isPracticeTourAvailable = (
	tour: Pick<TourDefinition, 'id' | 'when'>,
	flags?: Record<string, unknown>
): boolean =>
	isTourAvailable(
		{
			when: [tour.when ?? [], PRACTICE_TOUR_GATES[tour.id] ?? []].flat()
		},
		{ flags }
	);
