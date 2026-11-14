import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { OrisoTextField } from '../form/OrisoTextField';

export interface AskerDisplayNameFieldProps {
	value: string;
	onChange: (value: string) => void;
	editable: boolean;
	disabled?: boolean;
}

/**
 * The visible alias is independent of the immutable login credential/avatar.
 * Counsellors read it as the client's name, so it carries a visible hint and
 * opts out of password managers: a credential must never land here (#2073).
 */
export const AskerDisplayNameField = ({
	value,
	onChange,
	editable,
	disabled = false
}: AskerDisplayNameFieldProps) => {
	const { t } = useTranslation();
	return (
		<OrisoTextField
			name="displayName"
			value={value}
			placeholder={t('profile.data.displayName')}
			fullWidth
			disabled={disabled}
			onChange={(event) => {
				if (editable && !disabled) onChange(event.target.value);
			}}
			inputProps={{
				'aria-label': t('profile.data.displayName'),
				'autoComplete': 'off',
				'data-1p-ignore': 'true',
				'data-bwignore': 'true',
				'data-form-type': 'other',
				'data-lpignore': 'true',
				'maxLength': 255,
				'readOnly': !editable
			}}
			InputProps={{ readOnly: !editable }}
		/>
	);
};
