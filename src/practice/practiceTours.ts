import { isTourAvailable } from '../components/productTour/tourEngine';
import type { TourDefinition } from '../components/productTour/types';
import {
	practiceAcceptedSessionRoute,
	PRACTICE_ENQUIRIES_ROUTE,
	PRACTICE_LIVE_CHAT_QUEUE_ROUTE,
	PRACTICE_LIVE_CHAT_SETTINGS_ROUTE
} from './practiceRoutes';
import { PRACTICE_TOUR_EVENTS } from './practiceTourEvents';
import { PRACTICE_CALL_TARGETS } from './practiceCallTargets';
import {
	PRACTICE_ACCEPT_TOUR_ID,
	PRACTICE_GROUP_CIRCLE_TOUR_ID,
	PRACTICE_LIVE_CHAT_TOUR_ID,
	PRACTICE_SUPERVISION_TOUR_ID
} from './practiceTourIds';
import { LIVE_CHAT_TOUR_VERSION } from '../components/productTour/tours/liveChatTour';
import {
	consultantGroupCircleTour,
	GROUP_CIRCLE_SETTINGS_OPENED,
	GROUP_CIRCLE_TOUR_VERSION
} from '../components/productTour/tours/groupCircleTour';

/*
 * The two practice flows, a registry of their own: `frontendTours` feeds the
 * normal Help list and the auto-run, and a practice tour must start only from
 * its own card. Both are `dismissible: false`, so ESC or an overlay click can
 * never mark the exercise skipped.
 */

const SUPERVISION_ON = { flag: 'featureSupervisionEnabled' };

/**
 * Flow F1. FE#2491 (Frank, 23 Nov): the team chat has no button of its own
 * any more — it is switched on in "Weitere Funktionen", like supervision.
 * A step inside the menu flyout cannot be pointed at reliably, so the two
 * team steps (open the team chat, reply in it) left this flow; it has 6.
 */
export const practiceAcceptTour: TourDefinition = {
	id: PRACTICE_ACCEPT_TOUR_ID,
	version: 1,
	surface: 'frontend',
	audiences: ['consultant'],
	titleKey: 'tour.practiceAccept.title',
	summaryKey: 'tour.practiceAccept.summary',
	dismissible: false,
	requiredTargetPolicy: 'stop',
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
			id: 'accept',
			target: 'enquiry-accept-button',
			placement: 'top',
			advanceOn: { type: 'click' },
			titleKey: 'tour.practiceAccept.step.accept.title',
			contentKey: 'tour.practiceAccept.step.accept.intro'
		},
		{
			id: 'first-answer',
			// The accept cannot be undone: Back would land on a screen that no
			// longer exists (the enquiry is now an accepted case).
			hideBack: true,
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
	id: PRACTICE_SUPERVISION_TOUR_ID,
	version: 1,
	surface: 'frontend',
	audiences: ['consultant'],
	titleKey: 'tour.practiceSupervision.title',
	summaryKey: 'tour.practiceSupervision.summary',
	dismissible: false,
	requiredTargetPolicy: 'stop',
	when: SUPERVISION_ON,
	steps: [
		{
			// One step for the whole add. The real picker is a modal above the
			// tooltip (the theme's modal layer), so a second step could not be seen:
			// the intro names click, choose, reason and confirm; the confirm advances.
			id: 'add-supervisor',
			route: practiceAcceptedSessionRoute(),
			target: 'session-supervisor-add',
			placement: 'bottom',
			advanceOn: {
				type: 'event',
				name: PRACTICE_TOUR_EVENTS.supervisorAdded
			},
			titleKey: 'tour.practiceSupervision.step.addSupervisor.title',
			contentKey: 'tour.practiceSupervision.step.addSupervisor.intro'
		},
		{
			id: 'supervisor-reply',
			// The add cannot be undone, and Back would wait for it again.
			hideBack: true,
			target: 'supervision-panel',
			placement: 'left',
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

/**
 * FE#2545: the Live-Chat topic tour as a practice flow. A practice live chat
 * from an anonymous practice asker waits in the queue. The counsellor
 * switches "Bin verfügbar" on (in practice only), opens the chat, starts it
 * with the real button and writes the first reply, which the script answers.
 * Same id and version as the explanation tour it replaces where practice is
 * open, so Help shows one status; no card of its own.
 */
export const practiceLiveChatTour: TourDefinition = {
	id: PRACTICE_LIVE_CHAT_TOUR_ID,
	version: LIVE_CHAT_TOUR_VERSION,
	surface: 'frontend',
	audiences: ['consultant'],
	titleKey: 'tour.liveChat.title',
	summaryKey: 'tour.liveChat.summary',
	dismissible: false,
	requiredTargetPolicy: 'stop',
	when: { flag: 'featureAnonymousChatEnabled' },
	steps: [
		{
			id: 'intro',
			target: '',
			placement: 'center',
			titleKey: 'tour.liveChat.step.intro.title',
			contentKey: 'tour.liveChat.step.practiceIntro.intro'
		},
		{
			// Live chats only reach a counsellor who is available. The real
			// control (settings switch, or the rail toggle where the
			// counsellor moved it) flips a practice-only state: no request,
			// no storage, no heartbeat (`practiceLiveChatAvailability`).
			id: 'availability',
			route: PRACTICE_LIVE_CHAT_SETTINGS_ROUTE,
			target: 'livechat-availability-control',
			placement: 'auto',
			advanceOn: {
				type: 'event',
				name: PRACTICE_TOUR_EVENTS.liveChatAvailable
			},
			titleKey: 'tour.liveChat.step.practiceAvailability.title',
			contentKey: 'tour.liveChat.step.practiceAvailability.intro'
		},
		{
			// Switching on lands on the shared queue with the live-chat
			// filter already on, as in real life: the step explains it
			// (Next). A click would switch the filter off again.
			id: 'queue',
			route: PRACTICE_LIVE_CHAT_QUEUE_ROUTE,
			target: 'livechat-queue',
			placement: 'bottom',
			// The chip shows only where the Träger lists live chats apart.
			optional: true,
			titleKey: 'tour.liveChat.step.queue.title',
			contentKey: 'tour.liveChat.step.queue.intro'
		},
		{
			id: 'open-request',
			route: PRACTICE_LIVE_CHAT_QUEUE_ROUTE,
			target: 'enquiry-list-item',
			placement: 'right',
			advanceOn: { type: 'click' },
			titleKey: 'tour.liveChat.step.openRequest.title',
			contentKey: 'tour.liveChat.step.openRequest.intro'
		},
		{
			id: 'accept',
			target: 'enquiry-accept-button',
			placement: 'top',
			advanceOn: { type: 'click' },
			titleKey: 'tour.liveChat.step.accept.title',
			contentKey: 'tour.liveChat.step.accept.intro'
		},
		{
			id: 'reply',
			// The chat is started; Back would show a request that is gone.
			hideBack: true,
			target: 'session-composer',
			placement: 'top',
			advanceOn: {
				type: 'event',
				name: PRACTICE_TOUR_EVENTS.messageSent
			},
			titleKey: 'tour.liveChat.step.reply.title',
			contentKey: 'tour.liveChat.step.reply.intro'
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

/** The counsellor's own conversations, where "Erstellen" and circles live. */
const MY_SESSIONS_ROUTE = '/sessions/consultant/sessionView';

/**
 * FE#2545: the Gesprächskreis topic tour as a practice flow. The counsellor
 * creates a circle with the real create flow (topics, co-moderators and the
 * create itself are answered in memory), opens it from the list and starts
 * it with the real "Video-Call starten". That opens the practice call (D3,
 * revised): her own camera as a local preview and Carimat, the platform's
 * robot, speaking with a local voice; no call is placed. She mutes, turns the camera off, puts the
 * call into the real dock, brings it back and leaves. Same id and version as
 * the explanation tour it replaces where practice is open; no card of its
 * own.
 */
export const practiceGroupCircleTour: TourDefinition = {
	id: PRACTICE_GROUP_CIRCLE_TOUR_ID,
	version: GROUP_CIRCLE_TOUR_VERSION,
	surface: 'frontend',
	audiences: ['consultant'],
	titleKey: consultantGroupCircleTour.titleKey,
	summaryKey: consultantGroupCircleTour.summaryKey,
	dismissible: false,
	requiredTargetPolicy: 'stop',
	...(consultantGroupCircleTour.when && {
		when: consultantGroupCircleTour.when
	}),
	steps: [
		{
			id: 'intro',
			target: '',
			placement: 'center',
			titleKey: 'tour.groupCircle.step.intro.title',
			contentKey: 'tour.groupCircle.step.practiceIntro.intro'
		},
		{
			id: 'create',
			route: MY_SESSIONS_ROUTE,
			target: 'groupchat-create-button',
			placement: 'bottom',
			advanceOn: { type: 'click' },
			titleKey: 'tour.groupCircle.step.create.title',
			contentKey: 'tour.groupCircle.step.practiceCreate.intro'
		},
		{
			// Skipped where only one format is offered: no picker then.
			id: 'format',
			target: 'groupchat-format-circle',
			placement: 'auto',
			optional: true,
			titleKey: 'tour.groupCircle.step.format.title',
			contentKey: 'tour.groupCircle.step.format.intro'
		},
		{
			// Pick a topic, then the topic button opens the settings, which
			// have no route of their own: the screen announces itself.
			id: 'topic',
			target: 'groupchat-topic-picker',
			placement: 'auto',
			optional: true,
			advanceOn: { type: 'event', name: GROUP_CIRCLE_SETTINGS_OPENED },
			titleKey: 'tour.groupCircle.step.topic.title',
			contentKey: 'tour.groupCircle.step.practiceTopic.intro'
		},
		{
			// The counsellor fills what "Erstellen" needs, e.g. the
			// Beratungsstelle when she works for several: the card is the
			// spotlight, so its fields and their menus stay usable.
			id: 'configure',
			target: 'groupchat-circle-settings',
			placement: 'right',
			interactive: true,
			titleKey: 'tour.groupCircle.step.practiceConfigure.title',
			contentKey: 'tour.groupCircle.step.practiceConfigure.intro'
		},
		{
			// Back returns to `configure` while "Erstellen" is not ready.
			id: 'settings',
			target: 'groupchat-circle-create',
			placement: 'top',
			advanceOn: {
				type: 'event',
				name: PRACTICE_TOUR_EVENTS.circleCreated
			},
			titleKey: 'tour.groupCircle.step.practiceSettings.title',
			contentKey: 'tour.groupCircle.step.practiceSettings.intro'
		},
		{
			// Created: the app is back in the list, not in the circle.
			id: 'open-circle',
			hideBack: true,
			route: MY_SESSIONS_ROUTE,
			target: 'groupchat-list-item',
			placement: 'right',
			advanceOn: { type: 'click' },
			titleKey: 'tour.groupCircle.step.practiceOpen.title',
			contentKey: 'tour.groupCircle.step.practiceOpen.intro'
		},
		{
			// Starts the circle in memory and opens the practice call.
			id: 'start',
			target: 'groupchat-start-button',
			placement: 'top',
			advanceOn: {
				type: 'event',
				name: PRACTICE_TOUR_EVENTS.circleStarted
			},
			titleKey: 'tour.groupCircle.step.practiceStart.title',
			contentKey: 'tour.groupCircle.step.practiceStart.intro'
		},
		{
			// The circle is running: no way back to the waiting room.
			id: 'stage',
			hideBack: true,
			target: PRACTICE_CALL_TARGETS.stage,
			placement: 'center',
			titleKey: 'tour.groupCircle.step.practiceStage.title',
			contentKey: 'tour.groupCircle.step.practiceStage.intro'
		},
		{
			id: 'mute',
			target: PRACTICE_CALL_TARGETS.mute,
			placement: 'top',
			advanceOn: { type: 'click' },
			titleKey: 'tour.groupCircle.step.practiceMute.title',
			contentKey: 'tour.groupCircle.step.practiceMute.intro'
		},
		{
			id: 'camera',
			target: PRACTICE_CALL_TARGETS.camera,
			placement: 'top',
			advanceOn: { type: 'click' },
			titleKey: 'tour.groupCircle.step.practiceCamera.title',
			contentKey: 'tour.groupCircle.step.practiceCamera.intro'
		},
		{
			id: 'minimise',
			target: PRACTICE_CALL_TARGETS.minimise,
			placement: 'top',
			advanceOn: { type: 'click' },
			titleKey: 'tour.groupCircle.step.practiceMinimise.title',
			contentKey: 'tour.groupCircle.step.practiceMinimise.intro'
		},
		{
			// Back would point at the stage, which the dock replaced.
			id: 'expand',
			hideBack: true,
			target: PRACTICE_CALL_TARGETS.expand,
			placement: 'top',
			advanceOn: { type: 'click' },
			titleKey: 'tour.groupCircle.step.practiceExpand.title',
			contentKey: 'tour.groupCircle.step.practiceExpand.intro'
		},
		{
			id: 'leave',
			hideBack: true,
			target: PRACTICE_CALL_TARGETS.leave,
			placement: 'top',
			advanceOn: { type: 'click' },
			titleKey: 'tour.groupCircle.step.practiceLeave.title',
			contentKey: 'tour.groupCircle.step.practiceLeave.intro'
		},
		{
			// The call was left: nothing to go back to.
			id: 'done',
			hideBack: true,
			target: '',
			placement: 'center',
			titleKey: 'tour.groupCircle.step.done.title',
			contentKey: 'tour.groupCircle.step.practiceDone.intro'
		}
	]
};

/**
 * Every tour the practice world can host: the card flows and the topic tours
 * that run as practice where it is open. The tour host, the banner and the
 * host hooks read this list; the practice cards read `practiceTours` only.
 */
export const practiceHostedTours: TourDefinition[] = [
	...practiceTours,
	practiceLiveChatTour,
	practiceGroupCircleTour
];

/**
 * Whether a practice card is offered at all, from the tenant's flags (unset
 * counts as ON). Only the supervision tour can be unavailable; the accept tour
 * adapts through its step variants instead.
 */
export const isPracticeTourAvailable = (
	tour: Pick<TourDefinition, 'when'>,
	flags?: Record<string, unknown>
): boolean => isTourAvailable(tour, { flags });
