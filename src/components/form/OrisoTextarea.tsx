import * as React from 'react';
import { TextFieldProps } from '@mui/material';
import { OrisoTextField } from './OrisoTextField';

export type OrisoTextareaProps = TextFieldProps;

export const OrisoTextarea = ({
	minRows = 4,
	...props
}: OrisoTextareaProps) => (
	<OrisoTextField {...props} multiline minRows={minRows} />
);
