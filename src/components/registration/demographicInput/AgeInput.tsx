import * as React from 'react';
import { Dispatch, FC, SetStateAction, useContext, useMemo } from 'react';
import CakeRoundedIcon from '@mui/icons-material/CakeRounded';
import { RegistrationContext, RegistrationData } from '../../../globalState';
import { DemographicSelectInput } from './DemographicSelectInput';

export const AgeInput: FC<{
	onChange: Dispatch<SetStateAction<Partial<RegistrationData>>>;
}> = ({ onChange }) => {
	const { registrationConsultingType } = useContext(RegistrationContext);

	const options = useMemo(
		() =>
			registrationConsultingType?.requiredComponents?.age?.options?.map(
				(option) => ({
					value: option.value,
					label: option.label
				})
			) || [],
		[registrationConsultingType]
	);

	return (
		<DemographicSelectInput
			field="age"
			headlineKey="registration.age.headline"
			placeholderKey="registration.age.dropdown"
			Icon={CakeRoundedIcon}
			options={options}
			onChange={onChange}
		/>
	);
};
