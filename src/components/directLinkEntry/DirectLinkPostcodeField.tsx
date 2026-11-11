import * as React from 'react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OrisoTextField } from '../form/OrisoTextField';
import {
	DIRECT_LINK_POSTCODE_LENGTH,
	isDirectLinkPostcode
} from './directLinkPostcode';

export interface DirectLinkPostcodeFieldProps {
	value: string;
	onChange: (value: string) => void;
	/** Show the error although the field was not left yet (a tried submit). */
	showError?: boolean;
}

/**
 * The postcode of a registration through a direct link (ORISO-Frontend#1795):
 * five digits, and a line saying it is for statistics only.
 */
export const DirectLinkPostcodeField = ({
	value,
	onChange,
	showError = false
}: DirectLinkPostcodeFieldProps) => {
	const { t } = useTranslation();
	const [blurred, setBlurred] = useState(false);
	const id = useId();

	return (
		<OrisoTextField
			id={id}
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
			error={(blurred || showError) && !isDirectLinkPostcode(value)}
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
