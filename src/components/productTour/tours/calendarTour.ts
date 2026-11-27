import type { TourDefinition } from '../types';

/**
 * Version 2 (FE#2545): where the practice area is open the tour runs as a
 * practice flow (`practiceCalendarTour`) under this id and version, so the
 * Help list shows one status for both renderings.
 */
export const CALENDAR_TOUR_VERSION = 2;

/**
 * FE#2341: the counsellor calendar, watch-only. "+ Neu", the view switch
 * and ⋮ are explained on their buttons; the dialog and menus they open sit
 * above the tour layer. The view switch has two renderings (digits on wide
 * screens, a pill menu otherwise) that never coexist, so both carry the
 * anchor. Quick entry and working hours live in the desktop sidebar, the
 * links box only in the list view: those steps are optional.
 */
export const consultantCalendarTour: TourDefinition = {
	id: 'consultant-calendar',
	version: CALENDAR_TOUR_VERSION,
	surface: 'frontend',
	audiences: ['consultant'],
	titleKey: 'tour.calendar.title',
	summaryKey: 'tour.calendar.summary',
	steps: [
		{
			id: 'nav',
			route: '/booking/events',
			target: 'nav-calendar',
			placement: 'auto',
			titleKey: 'tour.calendar.step.nav.title',
			contentKey: 'tour.calendar.step.nav.intro'
		},
		{
			id: 'create',
			route: '/booking/events',
			target: 'calendar-create',
			placement: 'bottom',
			titleKey: 'tour.calendar.step.create.title',
			contentKey: 'tour.calendar.step.create.intro'
		},
		{
			id: 'view-switch',
			route: '/booking/events',
			target: 'calendar-view-switch',
			placement: 'bottom',
			titleKey: 'tour.calendar.step.viewSwitch.title',
			contentKey: 'tour.calendar.step.viewSwitch.intro'
		},
		{
			id: 'quick-entry',
			route: '/booking/events',
			target: 'calendar-quick-entry',
			placement: 'auto',
			optional: true,
			titleKey: 'tour.calendar.step.quickEntry.title',
			contentKey: 'tour.calendar.step.quickEntry.intro'
		},
		{
			id: 'working-hours',
			route: '/booking/events',
			target: 'calendar-working-hours',
			placement: 'auto',
			optional: true,
			titleKey: 'tour.calendar.step.workingHours.title',
			contentKey: 'tour.calendar.step.workingHours.intro'
		},
		{
			id: 'settings',
			route: '/booking/events',
			target: 'calendar-settings',
			placement: 'bottom',
			titleKey: 'tour.calendar.step.settings.title',
			contentKey: 'tour.calendar.step.settings.intro'
		},
		{
			id: 'links',
			route: '/booking/events',
			target: 'calendar-links',
			placement: 'auto',
			optional: true,
			titleKey: 'tour.calendar.step.links.title',
			contentKey: 'tour.calendar.step.links.intro'
		}
	]
};
