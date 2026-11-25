import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { subscribeToTourEvent } from '../components/productTour/tourEvents';
import { emitPracticeEvent, PRACTICE_TOUR_EVENTS } from './practiceTourEvents';

describe('practice tour events', () => {
	const unsubscribers: Array<() => void> = [];
	afterEach(() => {
		unsubscribers.splice(0).forEach((off) => off());
	});

	it('names the events the flows wait for', () => {
		expect(PRACTICE_TOUR_EVENTS).toEqual({
			teamMessageSent: 'practice:team-message-sent',
			messageSent: 'practice:message-sent',
			supervisorAdded: 'practice:supervisor-added',
			enquiryAccepted: 'practice:enquiry-accepted',
			circleCreated: 'practice:circle-created',
			circleStarted: 'practice:circle-started',
			circleCallStarted: 'practice:circle-call-started',
			liveChatAvailable: 'practice:live-chat-available',
			calendarAppointmentCreated: 'practice:calendar-appointment-created',
			calendarInvitationCreated: 'practice:calendar-invitation-created',
			calendarAppointmentCancelled:
				'practice:calendar-appointment-cancelled',
			calendarBlockerCreated: 'practice:calendar-blocker-created',
			calendarAutoAcceptOn: 'practice:calendar-auto-accept-on',
			caseHandoverOffered: 'practice:case-handover-offered',
			colleagueCaseListed: 'practice:colleague-case-listed',
			caseHandoverRequested: 'practice:case-handover-requested'
		});
	});

	it.each(Object.values(PRACTICE_TOUR_EVENTS))(
		'delivers %s through the tour event bus',
		(name) => {
			const listener = vi.fn();
			unsubscribers.push(subscribeToTourEvent(name, listener));
			emitPracticeEvent(name);
			expect(listener).toHaveBeenCalledTimes(1);
		}
	);

	it('does not wake a listener of another event', () => {
		const other = vi.fn();
		unsubscribers.push(
			subscribeToTourEvent(PRACTICE_TOUR_EVENTS.messageSent, other)
		);
		emitPracticeEvent(PRACTICE_TOUR_EVENTS.teamMessageSent);
		expect(other).not.toHaveBeenCalled();
	});
});
