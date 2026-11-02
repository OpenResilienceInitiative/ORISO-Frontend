import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { OrisoTextField } from '../../form/OrisoTextField';

interface RecoveryKeyFieldProps {
	disabled?: boolean;
	onChange: (value: string) => void;
	value: string;
}

/** The recovery-key entry wherever an existing key has to be typed in once. */
export const RecoveryKeyField = ({
	disabled,
	onChange,
	value
}: RecoveryKeyFieldProps) => {
	const { t } = useTranslation();
	return (
		<OrisoTextField
			label={t('profile.encryption.recover.inputLabel')}
			autoComplete="off"
			fullWidth
			inputProps={{
				'spellCheck': false,
				'data-cy': 'recovery-key-input'
			}}
			value={value}
			disabled={disabled}
			onChange={(event) => onChange(event.target.value)}
		/>
	);
};
