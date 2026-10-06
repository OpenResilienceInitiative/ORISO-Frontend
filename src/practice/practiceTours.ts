import { isTourAvailable } from '../components/productTour/tourEngine';
import type { TourDefinition } from '../components/productTour/types';
import {
	practiceAcceptedSessionRoute,
	practiceEnquirySessionRoute,
	PRACTICE_ENQUIRIES_ROUTE
} from './practiceRoutes';
import { PRACTICE_TOUR_EVENTS } from './practiceTourEvents';
import { PRACTICE_TOUR_IDS } from './practiceTourIds';

/**
 * The two practice flows (spec sections 3.3 and 3.4). A registry of their own:
 * `frontendTours` feeds the normal Help list and the auto-run, and a practice
 * tour must start only from its own card. Both are `dismissible: false`, so
 * ESC or an overlay click can never mark the exercise skipped.
 */
const [ACCEPT_TOUR_ID, SUPERVISION_TOUR_ID] = PRACTICE_TOUR_IDS;

const TEAM_DISCUSSION_ON = { flag: 'featureTeamDiscussionEnabled' };
const SUPERVISION_ON = { flag: 'featureSupervisionEnabled' };

/**
 * Flow F1. The Team-Besprechung steps exist only where the Träger switched the
 * feature on; `resolveTourSteps` drops them otherwise, so the banner counts 8
 * or 6 steps.
 */
export const practiceAcceptTour: TourDefinition = {
	id: ACCEPT_TOUR_ID,
	version: 1,
	surface: 'frontend',
	audiences: ['consultant'],
	titleKey: 'tour.practiceAccept.title',
	summaryKey: 'tour.practiceAccept.summary',
	dismissible: false,
	steps: [
		{
			id: 'nav-enquiries',
			target: 'nav-enquiries',
			placement: 'right',
			titleKey: 'tour.practiceAccept.step.navEnquiries.title',
			contentKey: 'tour.practiceAccept.step.navEnquiries.intro'
		},
		{
			id: 'open-enquiry',
			route: PRACTICE_ENQUIRIES_ROUTE,
			target: 'enquiry-list-item',
			placement: 'right',
			advanceOn: { type: 'click' },
			titleKey: 'tour.practiceAccept.step.openEnquiry.title',
			contentKey: 'tour.practiceAccept.step.openEnquiry.intro'
		},
		{
			id: 'open-team',
			// Also what "Back" from the panel returns to: the button is only
			// there while the panel is closed.
			route: practiceEnquirySessionRoute(),
			target: 'enquiry-team-button',
			placement: 'top',
			advanceOn: { type: 'click' },
			when: TEAM_DISCUSSION_ON,
			titleKey: 'tour.practiceAccept.step.openTeam.title',
			contentKey: 'tour.practiceAccept.step.openTeam.intro'
		},
		{
			id: 'team-reply',
			target: 'team-discussion-panel',
			placement: 'left',
			advanceOn: {
				type: 'event',
				name: PRACTICE_TOUR_EVENTS.teamMessageSent
			},
			when: TEAM_DISCUSSION_ON,
			titleKey: 'tour.practiceAccept.step.teamReply.title',
			contentKey: 'tour.practiceAccept.step.teamReply.intro'
		},
		{
			id: 'accept',
			target: 'enquiry-accept-button',
			placement: 'top',
			advanceOn: { type: 'click' },
			titleKey: 'tour.practiceAccept.step.accept.title',
			contentKey: 'tour.practiceAccept.step.accept.intro'
		},
		{
			id: 'first-answer',
			target: '',
			placement: 'center',
			titleKey: 'tour.practiceAccept.step.firstAnswer.title',
			contentKey: 'tour.practiceAccept.step.firstAnswer.intro'
		},
		{
			id: 'reply',
			target: 'session-composer',
			placement: 'top',
			advanceOn: {
				type: 'event',
				name: PRACTICE_TOUR_EVENTS.messageSent
			},
			titleKey: 'tour.practiceAccept.step.reply.title',
			contentKey: 'tour.practiceAccept.step.reply.intro'
		},
		{
			id: 'done',
			target: '',
			placement: 'center',
			titleKey: 'tour.practiceAccept.step.done.title',
			contentKey: 'tour.practiceAccept.step.done.intro'
		}
	]
};

/**
 * Flow F2. Hidden (not greyed out) when the Träger switched supervision off:
 * the card uses `isPracticeTourAvailable`, and the tour-level condition makes
 * the engine agree (no steps).
 */
export const practiceSupervisionTour: TourDefinition = {
	id: SUPERVISION_TOUR_ID,
	version: 1,
	surface: 'frontend',
	audiences: ['consultant'],
	titleKey: 'tour.practiceSupervision.title',
	summaryKey: 'tour.practiceSupervision.summary',
	dismissible: false,
	when: SUPERVISION_ON,
	steps: [
		{
			id: 'add-supervisor',
			route: practiceAcceptedSessionRoute(),
			target: 'session-supervisor-add',
			placement: 'bottom',
			advanceOn: { type: 'click' },
			titleKey: 'tour.practiceSupervision.step.addSupervisor.title',
			contentKey: 'tour.practiceSupervision.step.addSupervisor.intro'
		},
		{
			// The real picker is open and covers the page; there is nothing to
			// point at, so the step waits centered for the confirm.
			id: 'pick-supervisor',
			target: '',
			placement: 'center',
			advanceOn: {
				type: 'event',
				name: PRACTICE_TOUR_EVENTS.supervisorAdded
			},
			titleKey: 'tour.practiceSupervision.step.pickSupervisor.title',
			contentKey: 'tour.practiceSupervision.step.pickSupervisor.intro'
		},
		{
			id: 'supervisor-reply',
			target: '',
			placement: 'center',
			titleKey: 'tour.practiceSupervision.step.supervisorReply.title',
			contentKey: 'tour.practiceSupervision.step.supervisorReply.intro'
		},
		{
			id: 'standing-assignment',
			target: '',
			placement: 'center',
			titleKey: 'tour.practiceSupervision.step.standingAssignment.title',
			contentKey: 'tour.practiceSupervision.step.standingAssignment.intro'
		},
		{
			id: 'done',
			target: '',
			placement: 'center',
			titleKey: 'tour.practiceSupervision.step.done.title',
			contentKey: 'tour.practiceSupervision.step.done.intro'
		}
	]
};

export const practiceTours: TourDefinition[] = [
	practiceAcceptTour,
	practiceSupervisionTour
];

export const getPracticeTour = (
	tourId: string | undefined
): TourDefinition | undefined =>
	practiceTours.find((tour) => tour.id === tourId);

/**
 * Whether a practice card is offered at all, from the tenant's flags (unset
 * counts as ON). Only the supervision tour can be unavailable; the accept tour
 * adapts through its step variants instead.
 */
export const isPracticeTourAvailable = (
	tour: Pick<TourDefinition, 'when'>,
	flags?: Record<string, unknown>
): boolean => isTourAvailable(tour, { flags });
