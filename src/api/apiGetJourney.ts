import { endpoints } from '../resources/scripts/endpoints';
import type { PublicJourney } from '../components/journey/journeyModel';
import { fetchData, FETCH_ERRORS, FETCH_METHODS } from './fetchData';

const NONE: PublicJourney = { journeyId: null, journey: null, link: null };

const read = (url: string): Promise<PublicJourney> =>
	fetchData({
		url,
		method: FETCH_METHODS.GET,
		skipAuth: true,
		responseHandling: [
			FETCH_ERRORS.NO_MATCH,
			FETCH_ERRORS.CATCH_ALL_WITH_RESPONSE
		]
	})
		.then((answer: PublicJourney | null) =>
			answer && answer.journey ? answer : NONE
		)
		// No journey or no answer: the registration keeps its form of today, never stops.
		.catch(() => NONE);

/**
 * The journey whose registration runs for a topic, as the centre (if chosen) and its Träger
 * adapted it (ORISO-UserService#1700). Resolves `journey: null` where none is stored.
 */
export const apiGetRegistrationJourney = (topicId: number, agencyId?: number) =>
	read(
		`${endpoints.journeys}/registration?topicId=${encodeURIComponent(topicId)}${
			agencyId ? `&agencyId=${encodeURIComponent(agencyId)}` : ''
		}`
	);

/** The journey behind a link address `/l/<slug>`, with the link's topics and centre. */
export const apiGetLinkJourney = (slug: string, agencyId?: number) =>
	read(
		`${endpoints.journeys}/links/${encodeURIComponent(slug)}${
			agencyId ? `?agencyId=${encodeURIComponent(agencyId)}` : ''
		}`
	);
