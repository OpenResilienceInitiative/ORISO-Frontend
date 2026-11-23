import { describe, expect, it } from 'vite-plus/test';
import { frontendTopicTours } from '../tourDefinitions';
import { consultantCaseHandoverTour } from './caseHandoverTour';
import { itKeepsTheTourContract } from './tourDefinitionContract.testkit';

describe('consultant-case-handover', () => {
	itKeepsTheTourContract(consultantCaseHandoverTour, 'consultant');

	const steps = consultantCaseHandoverTour.steps;

	it('walks both directions and ends on the timeline', () => {
		expect(steps.map((step) => [step.id, step.target])).toEqual([
			['intro', ''],
			['offer', 'session-supervisor-add'],
			['search', 'sessions-search'],
			['request-access', 'case-handover-request-access'],
			['status', 'nav-activity'],
			['done', '']
		]);
	});

	it('makes only the content-dependent steps optional', () => {
		expect(
			steps.filter((step) => step.optional).map((step) => step.id)
		).toEqual(['offer', 'request-access']);
	});

	it('shows the header "+" before the first route, which would close a case', () => {
		const firstRoute = steps.findIndex((step) => step.route);
		expect(steps.findIndex((step) => step.id === 'offer')).toBeLessThan(
			firstRoute
		);
		expect(steps[firstRoute].route).toBe(
			'/sessions/consultant/sessionView'
		);
	});

	it('is the first topic tour', () => {
		expect(frontendTopicTours[0]).toBe(consultantCaseHandoverTour);
	});
});
