import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { OrisoTextField } from '../form/OrisoTextField';

export interface AskerDisplayNameFieldProps {
	value: string;
	onChange: (value: string) => void;
	editable: boolean;
	disabled?: boolean;
}

/** The visible alias is independent of the immutable login credential/avatar. */
export const AskerDisplayNameField = ({
	value,
	onChange,
	editable,
	disabled = false
}: AskerDisplayNameFieldProps) => {
	const { t } = useTranslation();
	return (
		<OrisoTextField
			value={value}
			fullWidth
			disabled={disabled}
			onChange={(event) => {
				if (editable && !disabled) onChange(event.target.value);
			}}
			inputProps={{
				'aria-label': t('profile.data.displayName'),
				'maxLength': 255,
				'readOnly': !editable
			}}
			InputProps={{ readOnly: !editable }}
		/>
	);
};
