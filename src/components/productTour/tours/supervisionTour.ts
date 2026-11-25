import type { TourDefinition, TourWhen } from '../types';

/**
 * FE#2545: the Supervision topic tour, under the id of the old practice card
 * "Übung: Supervisor hinzufügen" (already on the UserService progress
 * allowlist and the practice guard list) and its version 1, so a counsellor
 * who completed that card sees this tour as completed. Where the practice
 * area is open it runs as a practice flow (`practiceSupervisionTour`);
 * elsewhere this explanation runs under the same id and version.
 */
export const SUPERVISION_TOUR_ID = 'consultant-practice-supervision';
export const SUPERVISION_TOUR_VERSION = 1;

/**
 * "A supervision chat allows a call", exactly as
 * `resolveSupervisionCallFeatureGates` decides it: the master switch, then
 * video (switch plus supervision switch) or audio (the same). The one-on-one
 * keys play no part.
 */
export const SUPERVISION_CALLS_ALLOWED: TourWhen = {
	anyOf: [
		[
			{ flag: 'featureCallsEnabled' },
			{ flag: 'featureVideoCallsEnabled' },
			{ flag: 'featureVideoCallsSupervisionChatsEnabled' }
		],
		[
			{ flag: 'featureCallsEnabled' },
			{ flag: 'featureAudioCallsEnabled' },
			{ flag: 'featureAudioCallsSupervisionChatsEnabled' }
		]
	]
};

export const SUPERVISION_ON = { flag: 'featureSupervisionEnabled' };

/** The counsellor's own conversations, where the "Supervision" chip is. */
const MY_SESSIONS_ROUTE = '/sessions/consultant/sessionView';

/**
 * The explanation rendering, watch-only: for a window narrower than the
 * practice needs, or where the practice area is not open. The "+" and the
 * Supervision panel need an open supervised case, which a counsellor may
 * not have, so they are explained in text; the chip shows only where the
 * list has a supervised case and is optional.
 */
export const consultantSupervisionTour: TourDefinition = {
	id: SUPERVISION_TOUR_ID,
	version: SUPERVISION_TOUR_VERSION,
	surface: 'frontend',
	audiences: ['consultant'],
	titleKey: 'tour.supervision.title',
	summaryKey: 'tour.supervision.summary',
	when: SUPERVISION_ON,
	steps: [
		{
			id: 'intro',
			target: '',
			placement: 'center',
			titleKey: 'tour.supervision.step.intro.title',
			contentKey: 'tour.supervision.explain.intro'
		},
		{
			id: 'find',
			route: MY_SESSIONS_ROUTE,
			target: 'sessions-supervision-chip',
			placement: 'bottom',
			optional: true,
			titleKey: 'tour.supervision.step.find.title',
			contentKey: 'tour.supervision.step.find.intro'
		},
		{
			id: 'chat',
			target: '',
			placement: 'center',
			titleKey: 'tour.supervision.step.write.title',
			contentKey: 'tour.supervision.explain.chat'
		},
		{
			id: 'change',
			target: '',
			placement: 'center',
			titleKey: 'tour.supervision.step.change.title',
			contentKey: 'tour.supervision.explain.change'
		},
		{
			id: 'calls',
			target: '',
			placement: 'center',
			titleKey: 'tour.supervision.step.calls.title',
			contentKey: 'tour.supervision.explain.calls'
		},
		{
			id: 'appointment',
			target: '',
			placement: 'center',
			when: SUPERVISION_CALLS_ALLOWED,
			titleKey: 'tour.supervision.step.appointment.title',
			contentKey: 'tour.supervision.explain.appointment'
		},
		{
			id: 'done',
			target: '',
			placement: 'center',
			titleKey: 'tour.supervision.explain.done.title',
			contentKey: 'tour.supervision.explain.done.intro'
		}
	]
};
