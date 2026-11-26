import type { ITutorialProgressItem } from '../api/apiTutorialProgress';
import { CASE_HANDOVER_TOUR_VERSION } from '../components/productTour/tours/caseHandoverTour';
import {
	PRACTICE_CASE_HANDOVER_TOUR_ID,
	PRACTICE_SUPERVISION_TOUR_ID
} from './practiceTourIds';

const isTerminal = (status: ITutorialProgressItem['status']) =>
	status === 'completed' || status === 'skipped';

/**
 * FE#2545 (Frank): the practice card "Supervisor hinzufügen" was folded into
 * "Fälle übergeben". A counsellor who completed it keeps that state: the
 * current version of "Fälle übergeben" reads as completed, unless its own
 * record already says completed or skipped. Read-only: nothing is written,
 * and the old record stays on the server untouched.
 */
export const withFoldedPracticeProgress = <
	T extends Pick<ITutorialProgressItem, 'tourId' | 'tourVersion' | 'status'>
>(
	items: T[]
): T[] => {
	if (
		!items.some(
			(item) =>
				item.tourId === PRACTICE_SUPERVISION_TOUR_ID &&
				item.status === 'completed'
		)
	) {
		return items;
	}
	const isCurrentHandover = (item: T) =>
		item.tourId === PRACTICE_CASE_HANDOVER_TOUR_ID &&
		item.tourVersion === CASE_HANDOVER_TOUR_VERSION;
	const own = items.find(isCurrentHandover);
	if (own && isTerminal(own.status)) return items;
	const folded = {
		...(own ?? { surface: 'frontend' }),
		tourId: PRACTICE_CASE_HANDOVER_TOUR_ID,
		tourVersion: CASE_HANDOVER_TOUR_VERSION,
		status: 'completed'
	} as unknown as T;
	return [...items.filter((item) => !isCurrentHandover(item)), folded];
};
