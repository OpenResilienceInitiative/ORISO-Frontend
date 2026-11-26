import type { TourDefinition } from '../types';

/**
 * Version 2 (FE#2545): where the practice area is open the tour runs as a
 * practice flow (`practiceCaseHandoverTour`) under this id and version, so
 * the Help list shows one status for both renderings.
 */
export const CASE_HANDOVER_TOUR_VERSION = 2;

/**
 * Tour event: the sessions search menu closed (✓, Enter, Escape or a press
 * outside) while a name was typed or a person picked, so the list shows the
 * found cases instead of the menu. Without a running tour nobody listens.
 */
export const SESSIONS_SEARCH_CLOSED = 'sessions:search-closed';

/** Tour event: the sessions search menu opened and covers the list again. */
export const SESSIONS_SEARCH_OPENED = 'sessions:search-opened';

/**
 * FE#2341: case handover for counsellors, watch-only. Two directions: the
 * owner offers a case ("+" in the session header → "Beratung übergeben"),
 * a colleague asks for one (search a person → "Zugriff anfragen"). The
 * dialog and the ▾ menu sit above the tour layer, so they are explained on
 * the controls that open them. Card and header steps need content (a
 * colleague's takeable case, an open own case) and are optional. The
 * header step comes before the first route: navigating to the list closes
 * an open case, so it can only show when the tour starts inside one; the
 * closing step repeats the owner's way for everyone else.
 */
export const consultantCaseHandoverTour: TourDefinition = {
	id: 'consultant-case-handover',
	version: CASE_HANDOVER_TOUR_VERSION,
	surface: 'frontend',
	audiences: ['consultant'],
	titleKey: 'tour.caseHandover.title',
	summaryKey: 'tour.caseHandover.summary',
	steps: [
		{
			id: 'intro',
			target: '',
			placement: 'center',
			titleKey: 'tour.caseHandover.step.intro.title',
			contentKey: 'tour.caseHandover.step.intro.intro'
		},
		{
			id: 'offer',
			target: 'session-supervisor-add',
			placement: 'bottom',
			optional: true,
			titleKey: 'tour.caseHandover.step.offer.title',
			contentKey: 'tour.caseHandover.step.offer.intro'
		},
		{
			id: 'search',
			route: '/sessions/consultant/sessionView',
			target: 'sessions-search',
			placement: 'bottom',
			titleKey: 'tour.caseHandover.step.search.title',
			contentKey: 'tour.caseHandover.step.search.intro'
		},
		{
			id: 'request-access',
			target: 'case-handover-request-access',
			placement: 'auto',
			optional: true,
			titleKey: 'tour.caseHandover.step.requestAccess.title',
			contentKey: 'tour.caseHandover.step.requestAccess.intro'
		},
		{
			id: 'status',
			route: '/notifications',
			target: 'nav-activity',
			placement: 'auto',
			titleKey: 'tour.caseHandover.step.status.title',
			contentKey: 'tour.caseHandover.step.status.intro'
		},
		{
			id: 'done',
			target: '',
			placement: 'center',
			titleKey: 'tour.caseHandover.step.done.title',
			contentKey: 'tour.caseHandover.step.done.intro'
		}
	]
};
