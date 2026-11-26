import type { TourDefinition } from '../components/productTour/types';
import { isPracticeTourAvailable } from './practiceTours';

/**
 * Whether this tenant is offered the practice flow at all. Unset tenant flags
 * count as on (`!== false`, the app-wide convention); `flags` is the tenant's
 * settings, read reactively by the caller. A flow that is not offered is
 * hidden, not greyed out: the counsellor could do nothing about it.
 *
 * FE#2545: the supervision card (and with it its one-on-one gate) was folded
 * into "Fälle übergeben", where the supervision steps carry that gate.
 */
export const isPracticeTourOffered = (
	tour: Pick<TourDefinition, 'id' | 'when'>,
	flags?: Record<string, unknown>
): boolean => isPracticeTourAvailable(tour, flags);
