import type { TourDefinition } from '../types';

/**
 * FE#2341 / TOUR-11 (FE#1036): the counsellor profile, scoped down to the
 * areas that changed. Anchors sit on the section cards (`tourTarget` in the
 * profile route files). From 900px a tab renders all its cards on one page,
 * so a card can sit below the fold: those steps use `auto` placement and are
 * optional. The notification cards are alternatives (old and new
 * notifications) and share one anchor. Account deletion is left out.
 */
export const consultantProfileTour: TourDefinition = {
	id: 'consultant-profile',
	version: 1,
	surface: 'frontend',
	audiences: ['consultant'],
	titleKey: 'tour.profile.title',
	summaryKey: 'tour.profile.summary',
	steps: [
		{
			id: 'overview',
			route: '/profile/allgemeines',
			target: 'profile-overview',
			placement: 'center',
			titleKey: 'tour.profile.step.overview.title',
			contentKey: 'tour.profile.step.overview.intro'
		},
		{
			id: 'public',
			route: '/profile/allgemeines/oeffentlich',
			target: 'profile-public',
			placement: 'auto',
			optional: true,
			titleKey: 'tour.profile.step.public.title',
			contentKey: 'tour.profile.step.public.intro'
		},
		{
			id: 'absence',
			route: '/profile/aktivitaeten/abwesenheit',
			target: 'profile-absence',
			placement: 'auto',
			optional: true,
			titleKey: 'tour.profile.step.absence.title',
			contentKey: 'tour.profile.step.absence.intro'
		},
		{
			id: 'notifications',
			route: '/profile/einstellungen/email',
			target: 'profile-notifications',
			placement: 'auto',
			optional: true,
			titleKey: 'tour.profile.step.notifications.title',
			contentKey: 'tour.profile.step.notifications.intro'
		},
		{
			id: 'security',
			route: '/profile/einstellungen/sicherheit',
			target: 'profile-security',
			placement: 'auto',
			titleKey: 'tour.profile.step.security.title',
			contentKey: 'tour.profile.step.security.intro'
		},
		{
			id: 'display',
			route: '/profile/einstellungen/anzeige',
			target: 'profile-display',
			placement: 'auto',
			optional: true,
			titleKey: 'tour.profile.step.display.title',
			contentKey: 'tour.profile.step.display.intro'
		},
		{
			id: 'shortcuts',
			route: '/profile/einstellungen/tastatur',
			target: 'profile-shortcuts',
			placement: 'auto',
			optional: true,
			titleKey: 'tour.profile.step.shortcuts.title',
			contentKey: 'tour.profile.step.shortcuts.intro'
		},
		{
			id: 'help-tours',
			route: '/profile/hilfe/rundgaenge',
			target: 'profile-help-tours',
			placement: 'auto',
			titleKey: 'tour.profile.step.helpTours.title',
			contentKey: 'tour.profile.step.helpTours.intro'
		}
	]
};
