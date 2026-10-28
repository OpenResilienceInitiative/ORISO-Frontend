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
	/** Emitted on the accept; no step waits for it yet (the accept step
	 * advances on its click). Kept as the contract for one that will. */
	enquiryAccepted: 'practice:enquiry-accepted'
} as const;

export type PracticeTourEventName =
	(typeof PRACTICE_TOUR_EVENTS)[keyof typeof PRACTICE_TOUR_EVENTS];

export const emitPracticeEvent = (name: PracticeTourEventName): void =>
	emitTourEvent(name);
