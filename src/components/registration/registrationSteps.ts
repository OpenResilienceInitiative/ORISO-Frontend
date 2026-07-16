import { ComponentType, Dispatch, SetStateAction } from 'react';
import { ConsultingTypeInterface } from '../../globalState/interfaces';
import { RegistrationData } from '../../globalState';
import { AgeInput } from './demographicInput/AgeInput';
import { StateInput } from './demographicInput/StateInput';
export {
	getRegistrationValidationFields,
	toRegistrationValidationField
} from './registrationValidationFields';
export type { RegistrationStepFields } from './registrationValidationFields';

export type RegistrationStep = {
	component: ComponentType<{
		onChange: Dispatch<SetStateAction<Partial<RegistrationData>>>;
		onNextClick: () => void;
		nextStepUrl: string | null;
	}>;
	name: string;
	mandatoryFields?: string[];
	condition?: (params: {
		agency?: unknown;
		topic?: unknown;
		zipcode?: string;
	}) => boolean;
};

export const getDemographicRegistrationSteps = (
	consultingType?: ConsultingTypeInterface | null
): RegistrationStep[] => {
	const mandatoryFields = consultingType?.registration?.mandatoryFields;
	const steps: RegistrationStep[] = [];

	if (mandatoryFields?.age) {
		steps.push({
			component: AgeInput,
			name: 'age',
			mandatoryFields: ['age']
		});
	}

	if (mandatoryFields?.state) {
		steps.push({
			component: StateInput,
			name: 'state',
			mandatoryFields: ['state']
		});
	}

	return steps;
};

export const mergeRegistrationSteps = (
	baseSteps: RegistrationStep[],
	consultingType?: ConsultingTypeInterface | null
): RegistrationStep[] => {
	const demographicSteps = getDemographicRegistrationSteps(consultingType);
	const accountDataIndex = baseSteps.findIndex(
		(step) => step.name === 'account-data'
	);

	if (accountDataIndex === -1 || demographicSteps.length === 0) {
		return baseSteps;
	}

	return [
		...baseSteps.slice(0, accountDataIndex),
		...demographicSteps,
		...baseSteps.slice(accountDataIndex)
	];
};

type ConsultantDirectLinkAgency = {
	topicIds?: number[];
};

type ConsultantDirectLink = {
	agencies?: ConsultantDirectLinkAgency[];
};

export const getConsultantDirectLinkTopicIds = (
	consultant?: ConsultantDirectLink | null,
	directLinkAgency?: { topicIds?: number[] } | null
): number[] => {
	const fromConsultantAgencies = consultant?.agencies?.length
		? [
				...new Set(
					consultant.agencies.flatMap(
						(agency) => agency.topicIds ?? []
					)
				)
			]
		: [];

	if (fromConsultantAgencies.length > 0) {
		return fromConsultantAgencies;
	}

	if (directLinkAgency?.topicIds?.length) {
		return [...new Set(directLinkAgency.topicIds)];
	}

	return [];
};

export type RegistrationStepFilterParams = {
	preselectedConsultantId?: string | null;
	preselectedConsultant?: ConsultantDirectLink | null;
	preselectedTopic?: unknown;
	directLinkAgency?: unknown;
	directLinkZipcode?: string;
};

export const filterRegistrationStepsForDirectLink = (
	steps: RegistrationStep[],
	params: RegistrationStepFilterParams
): RegistrationStep[] => {
	const isConsultantDirectLink = Boolean(
		params.preselectedConsultantId && params.preselectedConsultant
	);

	return steps.filter((step) => {
		if (isConsultantDirectLink) {
			if (step.name === 'zipcode' || step.name === 'agency-selection') {
				return false;
			}

			const consultantTopicIds = getConsultantDirectLinkTopicIds(
				params.preselectedConsultant,
				params.directLinkAgency as { topicIds?: number[] } | undefined
			);

			if (
				step.name === 'topic-selection' &&
				(params.preselectedTopic || consultantTopicIds.length === 1)
			) {
				return false;
			}
		}

		return !step.condition?.({
			agency: params.directLinkAgency,
			topic: params.preselectedTopic,
			zipcode: params.directLinkZipcode
		});
	});
};
