import { describe, expect, it } from 'vite-plus/test';
import { getAvailableTours } from '../tourCatalogue';
import { frontendTopicTours } from '../tourDefinitions';
import { consultantVideoCallTour } from './videoCallTour';
import { itKeepsTheTourContract } from './tourDefinitionContract.testkit';

const available = (flags: Record<string, unknown>) =>
	getAvailableTours([consultantVideoCallTour], 'consultant', { flags });

describe('consultant-video-call', () => {
	itKeepsTheTourContract(consultantVideoCallTour, 'consultant');

	it('explains buttons, knocking and help, centred at both ends', () => {
		expect(consultantVideoCallTour.steps.map((step) => step.id)).toEqual([
			'intro',
			'session-call-button',
			'group-call-button',
			'knock',
			'help',
			'done'
		]);
	});

	it('makes every page-anchored step optional', () => {
		consultantVideoCallTour.steps.forEach((step) =>
			expect(step.target === '' || step.optional === true).toBe(true)
		);
	});

	it('never targets the running call', () => {
		const knock = consultantVideoCallTour.steps.find(
			(step) => step.id === 'knock'
		);
		expect(knock?.target).toBe('');
		consultantVideoCallTour.steps.forEach((step) =>
			expect(step.target).not.toMatch(/iframe|call-stage/)
		);
	});

	it('follows the one-on-one video call gates (unset counts as on)', () => {
		expect(available({})).toEqual([consultantVideoCallTour]);
		expect(available({ featureCallsEnabled: false })).toEqual([]);
		expect(available({ featureVideoCallsEnabled: false })).toEqual([]);
		expect(
			available({ featureVideoCallsOneOnOneChatsEnabled: false })
		).toEqual([]);
	});

	it('is registered as a topic tour', () => {
		expect(frontendTopicTours).toContain(consultantVideoCallTour);
	});
});
