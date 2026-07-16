// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import {
	filterRegistrationStepsForDirectLink,
	getConsultantDirectLinkTopicIds,
	RegistrationStep
} from './registrationSteps';

// The step registry imports the real step components and the globalState
// barrel, whose import chains reach i18n, lottie and other browser-only
// module-scope side effects. This test only exercises the pure step-filter
// helpers, so stub those imports out (vi.mock is hoisted above the imports).
vi.mock('./demographicInput/AgeInput', () => ({ AgeInput: () => null }));
vi.mock('./demographicInput/StateInput', () => ({ StateInput: () => null }));
vi.mock('../../globalState', () => ({}));

const baseSteps: RegistrationStep[] = [
	{
		name: 'topic-selection',
		component: (() => null) as RegistrationStep['component'],
		mandatoryFields: ['mainTopic'],
		condition: ({ topic }) => !!topic
	},
	{
		name: 'zipcode',
		component: (() => null) as RegistrationStep['component'],
		mandatoryFields: ['zipcode'],
		condition: ({ zipcode }) => !!zipcode
	},
	{
		name: 'agency-selection',
		component: (() => null) as RegistrationStep['component'],
		mandatoryFields: ['agency'],
		condition: ({ agency }) => !!agency
	},
	{
		name: 'account-data',
		component: (() => null) as RegistrationStep['component'],
		mandatoryFields: ['username', 'password']
	}
];

describe('registrationSteps direct link helpers', () => {
	it('collects unique consultant topic ids from agencies', () => {
		expect(
			getConsultantDirectLinkTopicIds({
				agencies: [{ topicIds: [1, 2] }, { topicIds: [2, 3] }]
			})
		).toEqual([1, 2, 3]);
	});

	it('falls back to direct link agency topic ids', () => {
		expect(
			getConsultantDirectLinkTopicIds(
				{ agencies: [{ id: 1 }] },
				{ topicIds: [1] }
			)
		).toEqual([1]);
	});

	it('uses direct link agency topic ids when consultant agencies omit them', () => {
		const steps = filterRegistrationStepsForDirectLink(baseSteps, {
			preselectedConsultantId: 'changing-it',
			preselectedConsultant: {
				agencies: [{ id: 1 }]
			},
			directLinkAgency: { id: 1, topicIds: [1] },
			directLinkZipcode: '00000'
		});

		expect(steps.map((step) => step.name)).toEqual(['account-data']);
	});

	it('skips focus when consultant counseling center has only one topic', () => {
		const steps = filterRegistrationStepsForDirectLink(baseSteps, {
			preselectedConsultantId: 'changing-it',
			preselectedConsultant: {
				agencies: [{ topicIds: [1] }]
			},
			directLinkZipcode: '00000',
			directLinkAgency: { id: 1 }
		});

		expect(steps.map((step) => step.name)).toEqual(['account-data']);
	});

	it('keeps focus when consultant has multiple topics', () => {
		const steps = filterRegistrationStepsForDirectLink(baseSteps, {
			preselectedConsultantId: 'changing-it',
			preselectedConsultant: {
				agencies: [{ topicIds: [1, 2] }]
			},
			directLinkZipcode: '00000',
			directLinkAgency: { id: 1 }
		});

		expect(steps.map((step) => step.name)).toEqual([
			'topic-selection',
			'account-data'
		]);
	});

	it('skips topic selection when tid is preselected on consultant links', () => {
		const steps = filterRegistrationStepsForDirectLink(baseSteps, {
			preselectedConsultantId: 'changing-it',
			preselectedConsultant: {
				agencies: [{ topicIds: [1] }]
			},
			preselectedTopic: { id: 1 },
			directLinkZipcode: '00000',
			directLinkAgency: { id: 1 }
		});

		expect(steps.map((step) => step.name)).toEqual(['account-data']);
	});
});
