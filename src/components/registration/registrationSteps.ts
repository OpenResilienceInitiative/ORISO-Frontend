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
		prevStepUrl?: string | null;
		/* Only the account-data step reads these, and only when an invitation
		   link brought the person here. Every other step ignores them. */
		entry?: 'registration' | 'link';
		conversationType?: 'AGENCY_COUNSELLING' | 'SELF_HELP';
		temporary?: boolean;
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

/**
 * The postcode UserService reads as an anonymous Live Chat guest
 * (`AnonymousSessionRegistration`): it clears the privacy confirmation and
 * hides the enquiry from counsellors until an in-chat consent.
 */
const GUEST_POSTCODE = '00000';

const isRealPostcode = (value?: string | null): value is string =>
	typeof value === 'string' &&
	/^[0-9]{5}$/.test(value) &&
	value !== GUEST_POSTCODE;

/**
 * The postcode a registration through a direct agency (`aid`) or counsellor
 * (`cid`) link is sent with, since those links skip the postcode step.
 *
 * It used to be the placeholder `00000`, which made every such registration an
 * anonymous guest to UserService: no privacy confirmation, and an enquiry no
 * counsellor could see (Dev, case 263, 23 Nov 2026). The order is the URL's own
 * postcode, then the linked agency's, then any of the counsellor's agencies.
 * With none of them the result is `undefined` and the person is asked.
 */
export const resolveDirectLinkZipcode = (params: {
	urlZipcode?: string | null;
	directLinkAgency?: { postcode?: string | null } | null;
	consultantAgencies?: { postcode?: string | null }[] | null;
}): string | undefined => {
	if (params.urlZipcode) {
		return params.urlZipcode;
	}
	return [params.directLinkAgency, ...(params.consultantAgencies ?? [])]
		.map((agency) => agency?.postcode)
		.find(isRealPostcode);
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
			// The postcode step goes only once a postcode is known: the
			// condition below drops it then, and keeps it when the
			// counsellor's agencies have none (see resolveDirectLinkZipcode).
			if (step.name === 'agency-selection') {
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
