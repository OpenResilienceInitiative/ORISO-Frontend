import * as React from 'react';
import { useState } from 'react';
import { TextField, TextFieldProps } from '@mui/material';
import { orisoTextFieldSx } from './orisoInputDesign';
import { ConcealedValueInput, isSecretField } from './ConcealedValueInput';

const mergeTextFieldSx = (sx?: TextFieldProps['sx']): TextFieldProps['sx'] => {
	if (!sx) {
		return orisoTextFieldSx;
	}

	return [
		orisoTextFieldSx,
		...(Array.isArray(sx) ? sx : [sx])
	] as TextFieldProps['sx'];
};

export const OrisoTextField = ({ sx, ...props }: TextFieldProps) => {
	const isSecret = isSecretField(props.type, props.autoComplete);
	// Stays on once set: the show-password toggle turns the type into "text",
	// and the password must not reach the HTML then either (FE#2582).
	const [concealValue, setConcealValue] = useState(isSecret);
	if (isSecret && !concealValue) {
		setConcealValue(true);
	}

	return (
		<TextField
			{...props}
			label={props.label ?? props.placeholder}
			placeholder={props.label ? props.placeholder : undefined}
			sx={mergeTextFieldSx(sx)}
			InputProps={
				concealValue && !props.multiline
					? {
							...props.InputProps,
							inputComponent: ConcealedValueInput
						}
					: props.InputProps
			}
		/>
	);
};
