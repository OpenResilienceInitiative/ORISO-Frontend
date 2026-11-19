import type { TourDefinition } from '../types';

/**
 * Asker first steps (FE#2343): where the conversations are, where to write,
 * where appointments, tools and the profile live, and where the tours can be
 * restarted. Watch-only. Steps whose anchors depend on content or settings
 * (an open conversation, an assigned counsellor's appointments, tools, the
 * Help tours card) are optional, so the tour completes on a fresh account.
 * The timeline is hidden for askers by design and stays out.
 */
export const askerFirstStepsTour: TourDefinition = {
	id: 'asker-first-steps',
	version: 1,
	surface: 'frontend',
	audiences: ['asker'],
	titleKey: 'tour.askerFirstSteps.title',
	summaryKey: 'tour.askerFirstSteps.summary',
	steps: [
		{
			id: 'welcome',
			target: '',
			placement: 'center',
			titleKey: 'tour.askerFirstSteps.step.welcome.title',
			contentKey: 'tour.askerFirstSteps.step.welcome.intro'
		},
		{
			// With exactly one conversation a first visit may open it; on
			// desktop the list stays visible beside it.
			id: 'sessions',
			route: '/sessions/user/view',
			target: 'sessions-list',
			placement: 'right',
			titleKey: 'tour.askerFirstSteps.step.sessions.title',
			contentKey: 'tour.askerFirstSteps.step.sessions.intro'
		},
		{
			id: 'composer',
			target: 'session-composer',
			placement: 'top',
			optional: true,
			titleKey: 'tour.askerFirstSteps.step.composer.title',
			contentKey: 'tour.askerFirstSteps.step.composer.intro'
		},
		{
			// Only shown once a counsellor is assigned.
			id: 'appointments',
			target: 'nav-calendar',
			placement: 'auto',
			optional: true,
			titleKey: 'tour.askerFirstSteps.step.appointments.title',
			contentKey: 'tour.askerFirstSteps.step.appointments.intro'
		},
		{
			id: 'tools',
			target: 'nav-tools',
			placement: 'auto',
			optional: true,
			titleKey: 'tour.askerFirstSteps.step.tools.title',
			contentKey: 'tour.askerFirstSteps.step.tools.intro'
		},
		{
			id: 'profile',
			route: '/profile/allgemeines',
			target: 'profile-overview',
			placement: 'center',
			titleKey: 'tour.askerFirstSteps.step.profile.title',
			contentKey: 'tour.askerFirstSteps.step.profile.intro'
		},
		{
			// The Help tours card only renders while tours are switched on;
			// lower on the page at desktop width, hence `auto`.
			id: 'help-tours',
			route: '/profile/hilfe/rundgaenge',
			target: 'help-tour-switch',
			placement: 'auto',
			optional: true,
			titleKey: 'tour.askerFirstSteps.step.helpTours.title',
			contentKey: 'tour.askerFirstSteps.step.helpTours.intro'
		}
	]
};
