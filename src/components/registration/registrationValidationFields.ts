export type RegistrationStepFields = {
	mandatoryFields?: string[];
};

const REGISTRATION_FIELD_TO_VALIDATION_KEY: Record<string, string> = {
	mainTopic: 'mainTopicId',
	agency: 'agencyId'
};

export const toRegistrationValidationField = (field: string): string =>
	REGISTRATION_FIELD_TO_VALIDATION_KEY[field] ?? field;

export const getRegistrationValidationFields = (
	availableSteps: RegistrationStepFields[]
): string[] => {
	const fields = new Set([
		'mainTopicId',
		'agencyId',
		'zipcode',
		'username',
		'password'
	]);

	availableSteps.forEach((step) => {
		step.mandatoryFields?.forEach((field) =>
			fields.add(toRegistrationValidationField(field))
		);
	});

	return [...fields];
};
