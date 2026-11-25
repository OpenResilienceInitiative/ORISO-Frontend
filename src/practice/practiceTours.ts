import { isTourAvailable } from '../components/productTour/tourEngine';
import type { TourDefinition } from '../components/productTour/types';
import {
	PRACTICE_ENQUIRIES_ROUTE,
	PRACTICE_LIVE_CHAT_QUEUE_ROUTE,
	PRACTICE_LIVE_CHAT_SETTINGS_ROUTE
} from './practiceRoutes';
import { PRACTICE_TOUR_EVENTS } from './practiceTourEvents';
import {
	PRACTICE_ACCEPT_TOUR_ID,
	PRACTICE_CALENDAR_TOUR_ID,
	PRACTICE_GROUP_CIRCLE_TOUR_ID,
	PRACTICE_LIVE_CHAT_TOUR_ID,
	PRACTICE_SUPERVISION_TOUR_ID
} from './practiceTourIds';
import { LIVE_CHAT_TOUR_VERSION } from '../components/productTour/tours/liveChatTour';
import { CALENDAR_TOUR_VERSION } from '../components/productTour/tours/calendarTour';
import {
	SUPERVISION_CALLS_ALLOWED,
	SUPERVISION_ON,
	SUPERVISION_TOUR_VERSION
} from '../components/productTour/tours/supervisionTour';
import {
	consultantGroupCircleTour,
	GROUP_CIRCLE_SETTINGS_OPENED,
	GROUP_CIRCLE_TOUR_VERSION
} from '../components/productTour/tours/groupCircleTour';

/*
 * The practice flows, a registry of their own: `frontendTours` feeds the
 * normal Help list and the auto-run, and a practice tour must start only from
 * its own card. Both are `dismissible: false`, so ESC or an overlay click can
 * never mark the exercise skipped.
 */

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

/** The counsellor's own conversations: "Erstellen", circles, the chips. */
const MY_SESSIONS_ROUTE = '/sessions/consultant/sessionView';

/** Practice step copy of the Supervision topic tour. */
const sup = (key: string) => ({
	titleKey: `tour.supervision.step.${key}.title`,
	contentKey: `tour.supervision.step.${key}.intro`
});

/**
 * FE#2545: the Supervision topic tour as a practice flow (product owner,
 * 2026-11-25). A practice enquiry waits; on accept the fake backend attaches
 * the standing supervisor Robin (Übung), as a real standing assignment would.
 * The counsellor finds the supervision in the list, writes in the side room
 * (Robin answers from the script), swaps Robin for Kim (Übung) with the real
 * "Supervisor verwalten" dialog and, where a supervision chat allows a call,
 * books an appointment with the supervisor. Every write is answered in
 * memory; nobody real is notified. After the swap the side room shows the
 * server's swap notice, built locally by the practice world.
 *
 * The old card's id, version 2 (PO, 25 Nov): new for everyone, also who
 * completed the old card. It has no card and no explanation rendering; it
 * runs only as practice from Help → Rundgänge, where its card shows a hint
 * below the practice width and is hidden without one-on-one supervision.
 */
export const practiceSupervisionTour: TourDefinition = {
	id: PRACTICE_SUPERVISION_TOUR_ID,
	version: SUPERVISION_TOUR_VERSION,
	surface: 'frontend',
	audiences: ['consultant'],
	titleKey: 'tour.supervision.title',
	summaryKey: 'tour.supervision.summary',
	dismissible: false,
	requiredTargetPolicy: 'stop',
	when: SUPERVISION_ON,
	steps: [
		{ id: 'intro', target: '', placement: 'center', ...sup('intro') },
		{
			id: 'open-enquiry',
			route: PRACTICE_ENQUIRIES_ROUTE,
			target: 'enquiry-list-item',
			placement: 'right',
			advanceOn: { type: 'click' },
			...sup('openEnquiry')
		},
		{
			id: 'accept',
			target: 'enquiry-accept-button',
			placement: 'top',
			advanceOn: { type: 'click' },
			...sup('accept')
		},
		{
			id: 'assigned',
			// The accept cannot be undone: Back would land on an enquiry that no
			// longer exists.
			hideBack: true,
			target: '',
			placement: 'center',
			...sup('assigned')
		},
		{
			id: 'find',
			route: MY_SESSIONS_ROUTE,
			target: 'sessions-supervision-chip',
			placement: 'bottom',
			// The chip shows only while the list holds a supervised case of
			// one's own; skipped, not stopped, where it is missing.
			optional: true,
			...sup('find')
		},
		{
			id: 'open-panel',
			target: 'session-supervision-indicator',
			placement: 'right',
			advanceOn: { type: 'click' },
			...sup('openPanel')
		},
		{
			id: 'write',
			target: 'supervision-panel',
			placement: 'left',
			advanceOn: {
				type: 'event',
				name: PRACTICE_TOUR_EVENTS.supervisionMessageSent
			},
			...sup('write')
		},
		{
			id: 'same-access',
			// The message is sent; Back would wait for it again.
			hideBack: true,
			target: 'supervision-panel',
			placement: 'left',
			...sup('sameAccess')
		},
		{
			// One step for the whole swap: the dialog is a modal above the
			// tooltip, so the intro names every click; the confirm advances.
			id: 'change',
			target: 'session-supervisor-add',
			placement: 'bottom',
			advanceOn: {
				type: 'event',
				name: PRACTICE_TOUR_EVENTS.supervisorReplaced
			},
			...sup('change')
		},
		{
			id: 'calls',
			// The swap cannot be undone in the tour.
			hideBack: true,
			target: '',
			placement: 'center',
			...sup('calls')
		},
		{
			id: 'appointment',
			when: SUPERVISION_CALLS_ALLOWED,
			target: 'supervision-panel-menu',
			placement: 'left',
			advanceOn: {
				type: 'event',
				name: PRACTICE_TOUR_EVENTS.supervisorAppointmentBooked
			},
			...sup('appointment')
		},
		{ id: 'done', target: '', placement: 'center', ...sup('done') }
	]
};

/** The flows with a practice card (Help → Meine Rundgänge): F1 only. */
export const practiceTours: TourDefinition[] = [practiceAcceptTour];

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

/**
 * FE#2545: the Gesprächskreis topic tour as a practice flow. The counsellor
 * creates a circle with the real create flow (topics, co-moderators and the
 * create itself are answered in memory), opens it from the list and starts
 * it with the real "Video-Call starten". The call is simulated (D3): the last
 * step shows the call button and blocks it. Same id and version as the
 * explanation tour it replaces where practice is open; no card of its own.
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
			// D3: the button is used, and practice shows a simulated start
			// instead of a call: no camera, no microphone, no request.
			id: 'call',
			hideBack: true,
			target: 'groupchat-call-button',
			placement: 'bottom',
			advanceOn: {
				type: 'event',
				name: PRACTICE_TOUR_EVENTS.circleCallStarted
			},
			titleKey: 'tour.groupCircle.step.practiceCall.title',
			contentKey: 'tour.groupCircle.step.practiceCall.intro'
		},
		{
			id: 'done',
			target: '',
			placement: 'center',
			titleKey: 'tour.groupCircle.step.done.title',
			contentKey: 'tour.groupCircle.step.practiceDone.intro'
		}
	]
};

/** "Meine Termine", where the calendar tour runs. */
const CALENDAR_ROUTE = '/booking/events';

/**
 * FE#2545: the Kalender topic tour as a practice flow, on the real calendar
 * with the practice advice seeker's conversation. The counsellor enters an
 * appointment, a second one with a Terminlink, cancels one, enters a
 * Sperrzeit and switches automatic confirmation on in the Sprechstunden.
 * Every write is answered in memory. The dialogs sit above the tour layer,
 * so each step points at the button that opens one, says what to do in it
 * and waits for the saved result. Same id and version as the explanation
 * tour it replaces where practice is open; no card of its own.
 */
export const practiceCalendarTour: TourDefinition = {
	id: PRACTICE_CALENDAR_TOUR_ID,
	version: CALENDAR_TOUR_VERSION,
	surface: 'frontend',
	audiences: ['consultant'],
	titleKey: 'tour.calendar.title',
	summaryKey: 'tour.calendar.summary',
	dismissible: false,
	requiredTargetPolicy: 'stop',
	steps: [
		{
			id: 'intro',
			target: '',
			placement: 'center',
			titleKey: 'tour.calendar.step.practiceIntro.title',
			contentKey: 'tour.calendar.step.practiceIntro.intro'
		},
		{
			id: 'appointment',
			route: CALENDAR_ROUTE,
			target: 'calendar-create',
			placement: 'bottom',
			advanceOn: {
				type: 'event',
				name: PRACTICE_TOUR_EVENTS.calendarAppointmentCreated
			},
			titleKey: 'tour.calendar.step.practiceAppointment.title',
			contentKey: 'tour.calendar.step.practiceAppointment.intro'
		},
		{
			// "Weitere Personen per Link einladen" takes the Art's medium;
			// the step needs the default Art, video, to be invitable.
			id: 'invitation',
			route: CALENDAR_ROUTE,
			target: 'calendar-create',
			placement: 'bottom',
			when: { flag: 'featureDirectInviteVideoEnabled' },
			advanceOn: {
				type: 'event',
				name: PRACTICE_TOUR_EVENTS.calendarInvitationCreated
			},
			titleKey: 'tour.calendar.step.practiceInvitation.title',
			contentKey: 'tour.calendar.step.practiceInvitation.intro'
		},
		{
			// The entry's menu and the confirmation are dialogs as well.
			id: 'cancel',
			route: CALENDAR_ROUTE,
			target: 'calendar-upcoming',
			placement: 'auto',
			advanceOn: {
				type: 'event',
				name: PRACTICE_TOUR_EVENTS.calendarAppointmentCancelled
			},
			titleKey: 'tour.calendar.step.practiceCancel.title',
			contentKey: 'tour.calendar.step.practiceCancel.intro'
		},
		{
			id: 'blocker',
			route: CALENDAR_ROUTE,
			target: 'calendar-create',
			placement: 'bottom',
			advanceOn: {
				type: 'event',
				name: PRACTICE_TOUR_EVENTS.calendarBlockerCreated
			},
			titleKey: 'tour.calendar.step.practiceBlocker.title',
			contentKey: 'tour.calendar.step.practiceBlocker.intro'
		},
		{
			// ⋮ → Sprechstunden; colleagues' automatic confirmation needs
			// colleagues, which the practice world does not have.
			id: 'auto-accept',
			route: CALENDAR_ROUTE,
			target: 'calendar-settings',
			placement: 'bottom',
			advanceOn: {
				type: 'event',
				name: PRACTICE_TOUR_EVENTS.calendarAutoAcceptOn
			},
			titleKey: 'tour.calendar.step.practiceAutoAccept.title',
			contentKey: 'tour.calendar.step.practiceAutoAccept.intro'
		},
		{
			id: 'done',
			target: '',
			placement: 'center',
			titleKey: 'tour.calendar.step.practiceDone.title',
			contentKey: 'tour.calendar.step.practiceDone.intro'
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
	practiceSupervisionTour,
	practiceLiveChatTour,
	practiceGroupCircleTour,
	practiceCalendarTour
];

/**
 * Whether a practice tour is offered at all, from the tenant's flags (unset
 * counts as ON); the supervision tour is the one a Träger can switch off.
 */
export const isPracticeTourAvailable = (
	tour: Pick<TourDefinition, 'when'>,
	flags?: Record<string, unknown>
): boolean => isTourAvailable(tour, { flags });
