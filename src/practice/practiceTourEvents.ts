import { emitTourEvent } from '../components/productTour/tourEvents';

/**
 * Events the practice tours wait for (`advanceOn: { type: 'event' }`). The
 * fake backend and the script engine emit them when the counsellor's own
 * action succeeded in practice mode.
 */
export const PRACTICE_TOUR_EVENTS = {
	teamMessageSent: 'practice:team-message-sent',
	messageSent: 'practice:message-sent',
	supervisorAdded: 'practice:supervisor-added',
	/** "Bin verfügbar" switched on in practice (FE#2545); never the real state. */
	liveChatAvailable: 'practice:live-chat-available',
	/** Emitted on the accept; no step waits for it yet (the accept step
	 * advances on its click). Kept as the contract for one that will. */
	enquiryAccepted: 'practice:enquiry-accepted',
	/** The practice Gesprächskreis was created (FE#2545). */
	circleCreated: 'practice:circle-created',
	/** The practice Gesprächskreis was started by its moderator (FE#2545). */
	circleStarted: 'practice:circle-started',
	/** A call button was used in practice: a simulated start, no call (D3). */
	circleCallStarted: 'practice:circle-call-started'
} as const;

export type PracticeTourEventName =
	(typeof PRACTICE_TOUR_EVENTS)[keyof typeof PRACTICE_TOUR_EVENTS];

export const emitPracticeEvent = (name: PracticeTourEventName): void =>
	emitTourEvent(name);
