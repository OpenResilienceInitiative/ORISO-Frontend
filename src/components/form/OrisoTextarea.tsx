import * as React from 'react';
import { TextFieldProps } from '@mui/material';
import { OrisoTextField } from './OrisoTextField';

export type OrisoTextareaProps = TextFieldProps;

/**
 * Multiline kit field. By default it grows with its content (`minRows`,
 * 4 to start). With `rows` it keeps a fixed box and scrolls instead, for
 * designs with a set field height.
 */
export const OrisoTextarea = ({
	minRows,
	maxRows,
	rows,
	...props
}: OrisoTextareaProps) => (
	<OrisoTextField
		{...props}
		multiline
		rows={rows}
		// Fixed rows take no bounds; MUI warns when either is combined.
		minRows={rows === undefined ? (minRows ?? 4) : undefined}
		maxRows={rows === undefined ? maxRows : undefined}
	/>
);
