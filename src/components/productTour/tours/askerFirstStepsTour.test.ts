import { describe, expect, it } from 'vite-plus/test';
import { getAvailableTours } from '../tourCatalogue';
import { frontendTopicTours } from '../tourDefinitions';
import { askerFirstStepsTour } from './askerFirstStepsTour';
import { itKeepsTheTourContract } from './tourDefinitionContract.testkit';

describe('asker-first-steps', () => {
	itKeepsTheTourContract(askerFirstStepsTour, 'asker');

	it('walks from the welcome through conversations to profile and tours', () => {
		expect(askerFirstStepsTour.steps.map((step) => step.id)).toEqual([
			'welcome',
			'sessions',
			'composer',
			'appointments',
			'tools',
			'profile',
			'help-tours'
		]);
	});

	it('keeps only content- or setting-dependent steps optional', () => {
		expect(
			askerFirstStepsTour.steps
				.filter((step) => step.optional)
				.map((step) => step.id)
		).toEqual(['composer', 'appointments', 'tools', 'help-tours']);
	});

	it('points at the neutral asker list, not the counsellor anchor', () => {
		const sessions = askerFirstStepsTour.steps.find(
			(step) => step.id === 'sessions'
		);
		expect(sessions).toMatchObject({
			route: '/sessions/user/view',
			target: 'sessions-list'
		});
	});

	it('leaves the timeline out (hidden for askers by design)', () => {
		askerFirstStepsTour.steps.forEach((step) => {
			expect(step.target).not.toBe('nav-activity');
			expect(step.route ?? '').not.toContain('/notifications');
		});
	});

	it('is registered after the mail-counselling tour and offered to askers only', () => {
		const ids = frontendTopicTours.map((tour) => tour.id);
		expect(ids.indexOf('asker-first-steps')).toBeGreaterThan(
			ids.indexOf('consultant-mail-counselling')
		);
		expect(
			getAvailableTours(frontendTopicTours, 'asker').map(
				(tour) => tour.id
			)
		).toContain('asker-first-steps');
		expect(
			getAvailableTours(frontendTopicTours, 'consultant').map(
				(tour) => tour.id
			)
		).not.toContain('asker-first-steps');
	});
});
