import type { TourDefinition } from '../types';

/**
 * Version 2 (FE#2545): where the practice area is open the tour runs as a
 * practice flow (`practiceLiveChatTour`) under this id and version, so the
 * Help list shows one status for both renderings.
 */
export const LIVE_CHAT_TOUR_VERSION = 2;

/**
 * TOUR-12 / FE#2342: Live chat for counsellors. Difference-first: live chat
 * is link-based, anonymous and topic-bound, and runs from one shared queue.
 * Watch-only — no step switches availability or accepts a chat. The rail
 * toggle exists only with the "via sidebar" preference, the queue chip only
 * while live chats are listed, the accept button only with an open request,
 * so those steps are optional and the tour completes on a fresh account.
 */
export const consultantLiveChatTour: TourDefinition = {
	id: 'consultant-live-chat',
	version: LIVE_CHAT_TOUR_VERSION,
	surface: 'frontend',
	audiences: ['consultant'],
	titleKey: 'tour.liveChat.title',
	summaryKey: 'tour.liveChat.summary',
	when: { flag: 'featureAnonymousChatEnabled' },
	steps: [
		{
			id: 'intro',
			target: '',
			placement: 'center',
			titleKey: 'tour.liveChat.step.intro.title',
			contentKey: 'tour.liveChat.step.intro.intro'
		},
		{
			id: 'availability-settings',
			route: '/profile/aktivitaeten/abwesenheit',
			target: 'livechat-availability-settings',
			placement: 'auto',
			titleKey: 'tour.liveChat.step.availabilitySettings.title',
			contentKey: 'tour.liveChat.step.availabilitySettings.intro'
		},
		{
			id: 'availability-toggle',
			route: '/sessions/consultant/sessionPreview',
			target: 'livechat-availability-toggle',
			placement: 'right',
			optional: true,
			titleKey: 'tour.liveChat.step.availabilityToggle.title',
			contentKey: 'tour.liveChat.step.availabilityToggle.intro'
		},
		{
			id: 'queue',
			route: '/sessions/consultant/sessionPreview',
			target: 'livechat-queue',
			placement: 'bottom',
			optional: true,
			titleKey: 'tour.liveChat.step.queue.title',
			contentKey: 'tour.liveChat.step.queue.intro'
		},
		{
			id: 'accept',
			target: 'enquiry-accept-button',
			placement: 'top',
			optional: true,
			titleKey: 'tour.liveChat.step.accept.title',
			contentKey: 'tour.liveChat.step.accept.intro'
		},
		{
			id: 'done',
			target: '',
			placement: 'center',
			titleKey: 'tour.liveChat.step.done.title',
			contentKey: 'tour.liveChat.step.done.intro'
		}
	]
};
