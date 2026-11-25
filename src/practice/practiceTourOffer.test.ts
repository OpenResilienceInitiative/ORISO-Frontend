import { describe, expect, it } from 'vite-plus/test';
import { practiceAcceptTour, practiceTours } from './practiceTours';
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

	it('does not let the one-on-one switch touch the accept flow', () => {
		expect(
			isPracticeTourOffered(practiceAcceptTour, {
				featureSupervisionOneOnOneChatsEnabled: false
			})
		).toBe(true);
	});

	it('has no Supervision card left to hide: it is part of "Fälle übergeben" (FE#2545)', () => {
		expect(practiceTours.map((tour) => tour.id)).toEqual([
			'consultant-practice-accept'
		]);
	});
});
