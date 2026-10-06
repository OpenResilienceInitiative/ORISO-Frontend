import { describe, expect, it } from 'vitest';
import type { TourDefinition } from '../components/productTour/types';
import { isPracticeTourAvailable } from './practiceTourAvailability';

const tour = (id: string, when?: TourDefinition['when']): TourDefinition => ({
	id,
	version: 1,
	surface: 'frontend',
	audiences: ['consultant'],
	titleKey: 'x',
	summaryKey: 'y',
	steps: [],
	when
});

const ACCEPT = tour('consultant-practice-accept');
const SUPERVISION = tour('consultant-practice-supervision');

describe('isPracticeTourAvailable', () => {
	it('offers the accept flow whatever the tenant switched off', () => {
		expect(
			isPracticeTourAvailable(ACCEPT, {
				featureSupervisionEnabled: false,
				featureTeamDiscussionEnabled: false
			})
		).toBe(true);
	});

	it('offers Supervision while the tenant never set the flag (unset is on)', () => {
		expect(isPracticeTourAvailable(SUPERVISION, {})).toBe(true);
		expect(isPracticeTourAvailable(SUPERVISION, undefined)).toBe(true);
	});

	it('hides Supervision when the tenant switched the feature off', () => {
		expect(
			isPracticeTourAvailable(SUPERVISION, {
				featureSupervisionEnabled: false
			})
		).toBe(false);
	});

	it('hides Supervision when one-on-one chats have no supervision, because the practice case is one', () => {
		expect(
			isPracticeTourAvailable(SUPERVISION, {
				featureSupervisionEnabled: true,
				featureSupervisionOneOnOneChatsEnabled: false
			})
		).toBe(false);
	});

	it('still honours a condition the tour definition brings itself', () => {
		const gated = tour('consultant-practice-accept', {
			flag: 'featureTeamDiscussionEnabled'
		});

		expect(
			isPracticeTourAvailable(gated, {
				featureTeamDiscussionEnabled: false
			})
		).toBe(false);
		expect(isPracticeTourAvailable(gated, {})).toBe(true);
	});
});
