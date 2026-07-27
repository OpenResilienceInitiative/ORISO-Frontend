import * as React from 'react';
import { TextareaHTMLAttributes, useCallback } from 'react';
import { v4 as uuid } from 'uuid';
import './textarea.styles';
import { OrisoTextarea } from './OrisoTextarea';

export interface TextareaProps
	extends TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = ({
	onChange,
	placeholder,
	id: customId,
	value,
	maxLength,
	disabled,
	name,
	required,
	readOnly,
	autoComplete,
	...attrs
}: TextareaProps) => {
	const id = customId ?? uuid();

	const handleChange = useCallback(
		(e) => {
			if (onChange) {
				onChange(e);
			}
		},
		[onChange]
	);

	return (
		<div className="textarea__wrapper">
			<OrisoTextarea
				id={id}
				onChange={handleChange}
				label={placeholder}
				value={value}
				disabled={disabled}
				name={name}
				required={required}
				autoComplete={autoComplete}
				inputProps={{
					maxLength,
					readOnly,
					...attrs
				}}
				helperText={
					maxLength
						? `${(value?.toString() ?? '').length} / ${maxLength}`
						: undefined
				}
				fullWidth
			/>
		</div>
	);
};
