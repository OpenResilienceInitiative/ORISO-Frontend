import * as React from 'react';
import { Dispatch, FC, SetStateAction, useMemo } from 'react';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import { useTranslation } from 'react-i18next';
import { RegistrationData } from '../../../globalState';
import { DemographicSelectInput } from './DemographicSelectInput';

export const StateInput: FC<{
	onChange: Dispatch<SetStateAction<Partial<RegistrationData>>>;
}> = ({ onChange }) => {
	const { t } = useTranslation();

	const options = useMemo(() => {
		const stateOptions = t('registration.state.options', {
			returnObjects: true
		}) as Record<string, string>;

		return Object.entries(stateOptions)
			.sort(([left], [right]) => Number(left) - Number(right))
			.map(([value, label]) => ({ value, label }));
	}, [t]);

	return (
		<DemographicSelectInput
			field="state"
			headlineKey="registration.state.headline"
			placeholderKey="registration.state.dropdown"
			Icon={PublicRoundedIcon}
			options={options}
			onChange={onChange}
		/>
	);
};
