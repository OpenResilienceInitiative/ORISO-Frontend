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

/**
 * TOUR-10: Mail counselling for consultants migrating from the legacy
 * platform. Difference-first framing — the audience knows what mail
 * counselling is; every step says where a workflow lives now or what is
 * genuinely new (Erstantwort, threads, voice messages, attachments). The
 * composer step is optional: its anchor only exists with an open session,
 * and the tour must complete on a fresh account.
 */
export const consultantMailCounsellingTour: TourDefinition = {
	id: 'consultant-mail-counselling',
	version: 1,
	surface: 'frontend',
	audiences: ['consultant'],
	titleKey: 'tour.mailCounselling.title',
	summaryKey: 'tour.mailCounselling.summary',
	steps: [
		{
			id: 'whats-new',
			target: '',
			placement: 'center',
			titleKey: 'tour.mailCounselling.step.whatsNew.title',
			contentKey: 'tour.mailCounselling.step.whatsNew.intro'
		},
		{
			id: 'enquiries',
			route: '/sessions/consultant/sessionPreview',
			target: 'consultant-enquiries-list',
			placement: 'right',
			titleKey: 'tour.mailCounselling.step.enquiries.title',
			contentKey: 'tour.mailCounselling.step.enquiries.intro'
		},
		{
			id: 'accepting',
			route: '/sessions/consultant/sessionPreview',
			target: 'consultant-enquiries-list',
			placement: 'right',
			titleKey: 'tour.mailCounselling.step.accepting.title',
			contentKey: 'tour.mailCounselling.step.accepting.intro'
		},
		{
			id: 'my-sessions',
			route: '/sessions/consultant/sessionView',
			target: 'consultant-sessions-list',
			placement: 'right',
			titleKey: 'tour.mailCounselling.step.mySessions.title',
			contentKey: 'tour.mailCounselling.step.mySessions.intro'
		},
		{
			id: 'composer',
			target: 'session-composer',
			placement: 'top',
			optional: true,
			titleKey: 'tour.mailCounselling.step.composer.title',
			contentKey: 'tour.mailCounselling.step.composer.intro'
		},
		{
			id: 'archive',
			route: '/sessions/consultant/sessionView?sessionListTab=archive',
			target: 'sessions-archive-tab',
			placement: 'bottom',
			titleKey: 'tour.mailCounselling.step.archive.title',
			contentKey: 'tour.mailCounselling.step.archive.intro'
		}
	]
};

export const frontendTours: TourDefinition[] = [
	consultantWalkthroughTour,
	consultantMailCounsellingTour
];
