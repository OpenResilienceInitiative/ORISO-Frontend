import { isTourAvailable } from '../components/productTour/tourEngine';
import type { TourDefinition } from '../components/productTour/types';
import { isPracticeTourAvailable } from './practiceTours';
import { PRACTICE_SUPERVISION_TOUR_ID } from './practiceTourIds';

/**
 * Tenant gates a practice tour needs on top of its own `when`. The Supervision
 * practice case is a one-on-one chat, and in one the "+" is only usable while
 * one-on-one supervision is on too (`SessionHeaderComponent`), so without this
 * the tour would stall on its first step.
 */
const ONE_ON_ONE_SUPERVISION = {
	flag: 'featureSupervisionOneOnOneChatsEnabled'
};

/**
 * Whether this tenant is offered the practice flow at all. Unset tenant flags
 * count as on (`!== false`, the app-wide convention); `flags` is the tenant's
 * settings, read reactively by the caller. A flow that is not offered is
 * hidden, not greyed out: the counsellor could do nothing about it.
 */
export const isPracticeTourOffered = (
	tour: Pick<TourDefinition, 'id' | 'when'>,
	flags?: Record<string, unknown>
): boolean =>
	isPracticeTourAvailable(tour, flags) &&
	(tour.id !== PRACTICE_SUPERVISION_TOUR_ID ||
		isTourAvailable({ when: ONE_ON_ONE_SUPERVISION }, { flags }));
