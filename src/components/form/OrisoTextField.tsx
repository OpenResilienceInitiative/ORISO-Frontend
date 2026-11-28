import * as React from 'react';
import { TextField, TextFieldProps } from '@mui/material';
import { orisoTextFieldSx } from './orisoInputDesign';
import { ConcealedValueInput, useConcealedValue } from './ConcealedValueInput';

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
	const concealValue = useConcealedValue(props.type, props.autoComplete);

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
