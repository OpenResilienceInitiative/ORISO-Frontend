import type { TourDefinition } from './types';

/**
 * Direct migration of the legacy intro.js consultant walkthrough: same five
 * steps, same i18n keys, same route behavior. Targets are semantic
 * `data-tour-target` anchors instead of the removed styling classes.
 */
export const consultantWalkthroughTour: TourDefinition = {
	id: 'consultant-walkthrough',
	version: 1,
	surface: 'frontend',
	audiences: ['consultant'],
	titleKey: 'walkthrough.title',
	summaryKey: 'walkthrough.subtitle',
	steps: [
		{
			id: 'intro',
			target: '',
			placement: 'center',
			titleKey: 'walkthrough.step.0.title',
			contentKey: 'walkthrough.step.0.intro'
		},
		{
			id: 'enquiries',
			route: '/sessions/consultant/sessionPreview',
			target: 'consultant-enquiries-list',
			placement: 'right',
			titleKey: 'walkthrough.step.1.title',
			contentKey: 'walkthrough.step.1.intro'
		},
		{
			id: 'my-sessions',
			route: '/sessions/consultant/sessionView',
			target: 'consultant-sessions-list',
			placement: 'right',
			titleKey: 'walkthrough.step.3.title',
			contentKey: 'walkthrough.step.3.intro'
		},
		{
			id: 'archive',
			route: '/sessions/consultant/sessionView?sessionListTab=archive',
			target: 'sessions-archive-tab',
			placement: 'bottom',
			titleKey: 'walkthrough.step.4.title',
			contentKey: 'walkthrough.step.4.intro'
		},
		{
			id: 'profile',
			route: '/profile/allgemeines',
			target: 'profile-overview',
			placement: 'center',
			titleKey: 'walkthrough.step.6.title',
			contentKey: 'walkthrough.step.6.intro'
		}
	]
};

export const frontendTours: TourDefinition[] = [consultantWalkthroughTour];
