import { describe, expect, it } from 'vite-plus/test';
import { resolveSupervisionCallFeatureGates } from '../../call/callFeatureGates';
import { resolveTourSteps } from '../tourEngine';
import {
	consultantSupervisionTour,
	SUPERVISION_TOUR_ID,
	SUPERVISION_TOUR_VERSION
} from './supervisionTour';
import { itKeepsTheTourContract } from './tourDefinitionContract.testkit';

describe('consultant-practice-supervision (explanation, FE#2545)', () => {
	itKeepsTheTourContract(
		consultantSupervisionTour,
		'consultant',
		SUPERVISION_TOUR_VERSION
	);

	it('keeps the old card id and version 1, so old completions still count', () => {
		expect(SUPERVISION_TOUR_ID).toBe('consultant-practice-supervision');
		expect(SUPERVISION_TOUR_VERSION).toBe(1);
	});

	it('explains the story in the practice order', () => {
		expect(consultantSupervisionTour.steps.map((s) => s.id)).toEqual([
			'intro',
			'find',
			'chat',
			'change',
			'calls',
			'appointment',
			'done'
		]);
	});

	it('points only at the chip, and only where the list shows it', () => {
		const anchored = consultantSupervisionTour.steps.filter(
			(s) => s.target !== ''
		);
		expect(anchored.map((s) => [s.id, s.target, s.optional])).toEqual([
			['find', 'sessions-supervision-chip', true]
		]);
	});

	it('shows the appointment step exactly where a supervision chat allows a call', () => {
		const cases: Array<Record<string, boolean>> = [
			{},
			{ featureCallsEnabled: false },
			{ featureVideoCallsSupervisionChatsEnabled: false },
			{
				featureVideoCallsSupervisionChatsEnabled: false,
				featureAudioCallsSupervisionChatsEnabled: false
			},
			{ featureVideoCallsEnabled: false, featureAudioCallsEnabled: false }
		];
		cases.forEach((flags) => {
			const gates = resolveSupervisionCallFeatureGates(flags);
			const ids = resolveTourSteps(consultantSupervisionTour, {
				flags
			}).map((s) => s.id);
			expect(ids.includes('appointment'), JSON.stringify(flags)).toBe(
				gates.audio || gates.video
			);
		});
	});
});
