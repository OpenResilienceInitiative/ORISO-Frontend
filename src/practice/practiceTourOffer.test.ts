import { describe, expect, it } from 'vitest';
import { practiceAcceptTour, practiceSupervisionTour } from './practiceTours';
import { isPracticeTourOffered } from './practiceTourOffer';

describe('isPracticeTourOffered', () => {
	it('offers the accept flow whatever the tenant switched off (it adapts through its variants)', () => {
		expect(
			isPracticeTourOffered(practiceAcceptTour, {
				featureSupervisionEnabled: false,
				featureTeamDiscussionEnabled: false
			})
		).toBe(true);
	});

	it('offers Supervision while the tenant never set the flag (unset is on)', () => {
		expect(isPracticeTourOffered(practiceSupervisionTour, {})).toBe(true);
		expect(isPracticeTourOffered(practiceSupervisionTour, undefined)).toBe(
			true
		);
	});

	it('hides Supervision when the tenant switched the feature off', () => {
		expect(
			isPracticeTourOffered(practiceSupervisionTour, {
				featureSupervisionEnabled: false
			})
		).toBe(false);
	});

	it('hides Supervision when one-on-one chats have no supervision, because the practice case is one', () => {
		expect(
			isPracticeTourOffered(practiceSupervisionTour, {
				featureSupervisionEnabled: true,
				featureSupervisionOneOnOneChatsEnabled: false
			})
		).toBe(false);
	});

	it('does not let the one-on-one switch touch the accept flow', () => {
		expect(
			isPracticeTourOffered(practiceAcceptTour, {
				featureSupervisionOneOnOneChatsEnabled: false
			})
		).toBe(true);
	});
});
