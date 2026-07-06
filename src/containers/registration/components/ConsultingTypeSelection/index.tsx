import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { SelectChangeEvent } from '@mui/material/Select';
import { OrisoSelect } from '../../../../components/form/OrisoSelect';
import { Text } from '../../../../components/text/Text';
import { ConsultingTypeInterface } from '../../../../globalState/interfaces';

interface ConsultingTypeSelectionArgs {
	value: string;
	onChange: (value: string) => void;
	onKeyDown?: (event: any) => void;
	consultingTypes: ConsultingTypeInterface[];
}

export const ConsultingTypeSelection = ({
	consultingTypes,
	value,
	onChange,
	onKeyDown
}: ConsultingTypeSelectionArgs) => {
	const { t } = useTranslation(['common', 'consultingTypes']);

	const consultingTypeOptions = useMemo(
		() =>
			consultingTypes.map((consultingType) => ({
				value: consultingType.id.toString(),
				label: t(
					[
						`consultingType.${consultingType.id}.titles.long`,
						`consultingType.fallback.titles.long`,
						consultingType.titles.long
					],
					{ ns: 'consultingTypes' }
				)
			})),
		[consultingTypes, t]
	);

	const selectLabel = t(
		'registration.consultingTypeAgencySelection.consultingType.select.label'
	);
	const selectValue =
		consultingTypeOptions.find((cTO) => cTO.value === value)?.value ||
		consultingTypeOptions[0]?.value ||
		'';

	const handleConsultingTypeSelect = (event: SelectChangeEvent<string>) => {
		onChange(event.target.value);
	};

	return (
		<div className="consultingTypeSelection__possibleConsultingTypes">
			<Text
				text={t(
					'registration.consultingTypeAgencySelection.consultingType.infoText'
				)}
				type="standard"
			/>
			<OrisoSelect
				id="consultingTypeSelection"
				label={selectLabel}
				options={consultingTypeOptions}
				value={selectValue}
				onChange={handleConsultingTypeSelect}
				onKeyDown={(event) => onKeyDown?.(event)}
			/>
		</div>
	);
};
