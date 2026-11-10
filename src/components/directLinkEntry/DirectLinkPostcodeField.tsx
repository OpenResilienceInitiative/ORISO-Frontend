import * as React from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OrisoTextField } from '../form/OrisoTextField';
import {
	DIRECT_LINK_POSTCODE_LENGTH,
	isDirectLinkPostcode
} from './directLinkPostcode';

export interface DirectLinkPostcodeFieldProps {
	value: string;
	onChange: (value: string) => void;
}

/**
 * The postcode of a registration through a direct link (ORISO-Frontend#1795):
 * five digits, and a line saying it is for statistics only.
 */
export const DirectLinkPostcodeField = ({
	value,
	onChange
}: DirectLinkPostcodeFieldProps) => {
	const { t } = useTranslation();
	const [blurred, setBlurred] = useState(false);

	return (
		<OrisoTextField
			value={value}
			onChange={(event) =>
				onChange(
					event.target.value
						.replace(/[^0-9]/g, '')
						.slice(0, DIRECT_LINK_POSTCODE_LENGTH)
				)
			}
			onBlur={() => setBlurred(true)}
			label={t('registration.zipcode.label')}
			helperText={t('directLink.postcode.helper')}
			error={blurred && !isDirectLinkPostcode(value)}
			fullWidth
			autoComplete="postal-code"
			inputProps={{
				'inputMode': 'numeric',
				'pattern': '[0-9]*',
				'aria-required': true,
				'maxLength': DIRECT_LINK_POSTCODE_LENGTH,
				'data-cy': 'direct-link-postcode'
			}}
		/>
	);
};
