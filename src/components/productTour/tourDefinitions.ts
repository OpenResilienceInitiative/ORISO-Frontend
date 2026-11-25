import { tourAvailability } from './tourCatalogue';
import { consultantCalendarTour } from './tours/calendarTour';
import { consultantCaseHandoverTour } from './tours/caseHandoverTour';
import {
	consultantGroupCircleTour,
	isGroupCircleTourAvailable
} from './tours/groupCircleTour';
import { consultantProfileTour } from './tours/profileTour';
import type { TourDefinition } from './types';
import { askerFirstStepsTour } from './tours/askerFirstStepsTour';
import { askerSettingsTour } from './tours/askerSettingsTour';
import { consultantLiveChatTour } from './tours/liveChatTour';
import { consultantTimelineTour } from './tours/timelineTour';
import { consultantVideoCallTour } from './tours/videoCallTour';

/**
 * FE#2545: the Einführung is version 2 (PO: a reworked tour shows as new, a
 * completion of version 1 does not count). Where practice can run, a
 * deliberate start runs its practice rendering (`practiceIntroTour`) under
 * the same id and version.
 */
export const INTRO_TOUR_VERSION = 2;

/**
 * Direct migration of the legacy intro.js consultant walkthrough: same five
 * steps, same i18n keys, same route behavior. Targets are semantic
 * `data-tour-target` anchors instead of the removed styling classes. Since
 * FE#2545 this is the watch-only Einführung: the auto-start after login, and
 * the fallback where the practice cannot run (phone, a window below the
 * practice width, practice area off).
 */
export const consultantWalkthroughTour: TourDefinition = {
	id: 'consultant-walkthrough',
	version: INTRO_TOUR_VERSION,
	surface: 'frontend',
	audiences: ['consultant'],
	titleKey: 'walkthrough.introduction.title',
	summaryKey: 'walkthrough.introduction.summary',
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

/**
 * Topic tours, in Frank's priority order (2026-11-18). Offered below the
 * introduction in Help → Rundgänge and in the "?" launcher; each audience
 * sees its own (`getAvailableTours`).
 */
export const frontendTopicTours: TourDefinition[] = [
	consultantCaseHandoverTour,
	consultantCalendarTour,
	consultantGroupCircleTour,
	consultantProfileTour,
	consultantLiveChatTour,
	consultantTimelineTour,
	consultantVideoCallTour,
	consultantMailCounsellingTour,
	askerFirstStepsTour,
	askerSettingsTour
];

// Gates beyond a tenant flag (`tourCatalogue.ts`).
tourAvailability[consultantGroupCircleTour.id] = isGroupCircleTourAvailable;

export const frontendTours: TourDefinition[] = [
	consultantWalkthroughTour,
	...frontendTopicTours
];
