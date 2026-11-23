import type { TourDefinition } from '../types';

/**
 * FE#2342: The timeline and drafts for counsellors. Difference-first: one
 * timeline replaces scattered notifications, and unsent drafts are kept per
 * conversation and collected on one page. Watch-only. Filters and
 * "mark all read" only exist with entries (and are hidden on the icon rail),
 * the drafts chip can be hidden by the display filter — those steps are
 * optional. The drafts page has no link in the app today; the tour opens it
 * by route.
 */
export const consultantTimelineTour: TourDefinition = {
	id: 'consultant-timeline',
	version: 1,
	surface: 'frontend',
	audiences: ['consultant'],
	titleKey: 'tour.timeline.title',
	summaryKey: 'tour.timeline.summary',
	steps: [
		{
			id: 'activity-nav',
			route: '/notifications',
			target: 'nav-activity',
			placement: 'right',
			titleKey: 'tour.timeline.step.activityNav.title',
			contentKey: 'tour.timeline.step.activityNav.intro'
		},
		{
			id: 'timeline',
			route: '/notifications',
			target: 'timeline-page',
			placement: 'center',
			titleKey: 'tour.timeline.step.timeline.title',
			contentKey: 'tour.timeline.step.timeline.intro'
		},
		{
			id: 'filters',
			route: '/notifications',
			target: 'timeline-filters',
			placement: 'bottom',
			optional: true,
			titleKey: 'tour.timeline.step.filters.title',
			contentKey: 'tour.timeline.step.filters.intro'
		},
		{
			id: 'mark-all-read',
			route: '/notifications',
			target: 'timeline-mark-all-read',
			placement: 'bottom',
			optional: true,
			titleKey: 'tour.timeline.step.markAllRead.title',
			contentKey: 'tour.timeline.step.markAllRead.intro'
		},
		{
			id: 'drafts-chip',
			route: '/sessions/consultant/sessionView',
			target: 'sessions-drafts-chip',
			placement: 'bottom',
			optional: true,
			titleKey: 'tour.timeline.step.draftsChip.title',
			contentKey: 'tour.timeline.step.draftsChip.intro'
		},
		{
			id: 'drafts-center',
			route: '/drafts',
			target: 'drafts-center',
			placement: 'center',
			titleKey: 'tour.timeline.step.draftsCenter.title',
			contentKey: 'tour.timeline.step.draftsCenter.intro'
		}
	]
};
