import * as React from 'react';
import { TextField, TextFieldProps } from '@mui/material';
import { orisoTextFieldSx } from './orisoInputDesign';

const mergeTextFieldSx = (sx?: TextFieldProps['sx']): TextFieldProps['sx'] => {
	if (!sx) {
		return orisoTextFieldSx;
	}

	return [
		orisoTextFieldSx,
		...(Array.isArray(sx) ? sx : [sx])
	] as TextFieldProps['sx'];
};

export const OrisoTextField = ({ sx, ...props }: TextFieldProps) => (
	<TextField {...props} sx={mergeTextFieldSx(sx)} />
);
