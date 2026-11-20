import * as React from 'react';
import { useEffect, useId, useState } from 'react';
import dayjs from 'dayjs';
import {
	FormControl,
	FormControlLabel,
	FormHelperText,
	FormLabel,
	Radio,
	RadioGroup as MuiRadioGroup
} from '@mui/material';
import { AppThemeProvider } from '../../resources/scripts/AppThemeProvider';
import {
	BUTTON_TYPES,
	Button as CoreButton
} from '../../components/button/Button';
import { OrisoTextField } from '../../components/form/OrisoTextField';
import { OrisoTextarea } from '../../components/form/OrisoTextarea';
import { OrisoSelect } from '../../components/form/OrisoSelect';
import { OrisoDatePicker } from '../../components/form/OrisoDatePicker';
import { orisoInputColors } from '../../components/form/orisoInputDesign';
import { M3Checkbox } from '../../components/M3Checkbox';
import { Notice as CoreNotice } from '../../components/notice/Notice';
import { Card as CoreCard } from '../../components/card';
import {
	Headline as CoreHeadline,
	HeadlineLevel
} from '../../components/headline/Headline';
import { LoadingSpinner } from '../../components/loadingSpinner/LoadingSpinner';
import type {
	KitButtonProps,
	KitCardProps,
	KitCheckboxProps,
	KitDatePickerProps,
	KitHeadlineProps,
	KitNoticeProps,
	KitNumberFieldProps,
	KitProviderProps,
	KitRadioGroupProps,
	KitSelectProps,
	KitTextareaProps,
	KitTextFieldProps,
	WebKit
} from './types';

export * from './types';

export const WEB_KIT_VERSION = '1.1.0';

const BUTTON_TYPE_BY_VARIANT = {
	primary: BUTTON_TYPES.PRIMARY,
	secondary: BUTTON_TYPES.SECONDARY,
	tertiary: BUTTON_TYPES.TERTIARY,
	link: BUTTON_TYPES.LINK
} as const;

const escapeHtml = (text: string) =>
	text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');

// Add-ons render in their own React root, outside the host's providers.
const Provider = ({ children }: KitProviderProps) => (
	<AppThemeProvider>{children}</AppThemeProvider>
);

const Button = ({
	children,
	onClick,
	variant = 'primary',
	disabled,
	id,
	title,
	type = 'button'
}: KitButtonProps) => (
	<CoreButton
		item={{ type: BUTTON_TYPE_BY_VARIANT[variant], id, title }}
		buttonHandle={onClick ? () => onClick() : undefined}
		disabled={disabled}
		type={type}
	>
		{children}
	</CoreButton>
);

const TextField = ({ onChange, maxLength, ...props }: KitTextFieldProps) => (
	<OrisoTextField
		{...props}
		fullWidth
		onChange={(event) => onChange(event.target.value)}
		inputProps={{ maxLength }}
	/>
);

const Textarea = ({ onChange, maxLength, ...props }: KitTextareaProps) => (
	<OrisoTextarea
		{...props}
		fullWidth
		onChange={(event) => onChange(event.target.value)}
		inputProps={{ maxLength }}
	/>
);

const Checkbox = (props: KitCheckboxProps) => <M3Checkbox {...props} />;

const Select = ({ onChange, ...props }: KitSelectProps) => (
	<OrisoSelect
		{...props}
		onChange={(event) => onChange(event.target.value)}
	/>
);

const RadioGroup = ({
	label,
	options,
	value,
	onChange,
	disabled,
	helperText,
	error,
	id
}: KitRadioGroupProps) => {
	const generatedId = useId();
	const baseId = id ?? generatedId;
	const helperId = helperText ? `${baseId}-helper` : undefined;
	return (
		<FormControl
			component="fieldset"
			id={baseId}
			disabled={disabled}
			error={error}
			sx={{ border: 0, m: 0, p: 0, minWidth: 0 }}
		>
			<FormLabel
				component="legend"
				sx={{
					'color': orisoInputColors.onSurface,
					'mb': 0.5,
					'&.Mui-focused': { color: orisoInputColors.onSurface }
				}}
			>
				{label}
			</FormLabel>
			<MuiRadioGroup
				value={value}
				onChange={(_, next) => onChange(next)}
				aria-describedby={helperId}
			>
				{options.map((option) => (
					<FormControlLabel
						key={option.value}
						value={option.value}
						label={option.label}
						disabled={disabled || option.disabled}
						control={
							<Radio
								sx={{
									'color': orisoInputColors.outline,
									'&.Mui-checked': {
										color: orisoInputColors.primary
									}
								}}
							/>
						}
					/>
				))}
			</MuiRadioGroup>
			{helperText && (
				<FormHelperText id={helperId}>{helperText}</FormHelperText>
			)}
		</FormControl>
	);
};

const ISO_DATE = 'YYYY-MM-DD';

const toDay = (value?: string) => {
	if (!value) {
		return undefined;
	}
	const day = dayjs(value, ISO_DATE, true);
	return day.isValid() ? day : undefined;
};

const DatePicker = ({
	label,
	value,
	onChange,
	min,
	max,
	disabled,
	helperText,
	error,
	id
}: KitDatePickerProps) => (
	<OrisoDatePicker
		id={id}
		label={label}
		value={toDay(value) ?? null}
		onChange={(day) => onChange(day ? day.format(ISO_DATE) : '')}
		minDate={toDay(min)}
		maxDate={toDay(max)}
		weekStart={1}
		disabled={disabled}
		helperText={helperText}
		error={error}
	/>
);

const parseNumber = (text: string) => {
	if (text.trim() === '') {
		return null;
	}
	const parsed = Number(text);
	return Number.isFinite(parsed) ? parsed : null;
};

const NumberField = ({
	value,
	onChange,
	min,
	max,
	step,
	...props
}: KitNumberFieldProps) => {
	// Keeps what is typed, so "-" or "1," on the way to a number is not wiped out.
	const [text, setText] = useState(value == null ? '' : String(value));
	useEffect(() => {
		setText((current) =>
			parseNumber(current) === value
				? current
				: value == null
					? ''
					: String(value)
		);
	}, [value]);
	return (
		<OrisoTextField
			{...props}
			type="number"
			fullWidth
			value={text}
			onChange={(event) => {
				setText(event.target.value);
				onChange(parseNumber(event.target.value));
			}}
			inputProps={{ min, max, step, inputMode: 'decimal' }}
		/>
	);
};

const Notice = ({ title, children, type }: KitNoticeProps) => (
	<CoreNotice title={title} type={type}>
		{children}
	</CoreNotice>
);

const Card = ({ children }: KitCardProps) => <CoreCard>{children}</CoreCard>;

const Headline = ({ children, level = 2, styleLevel }: KitHeadlineProps) => (
	<CoreHeadline
		text={escapeHtml(children)}
		semanticLevel={String(level) as HeadlineLevel}
		styleLevel={
			styleLevel ? (String(styleLevel) as HeadlineLevel) : undefined
		}
	/>
);

const Spinner = () => <LoadingSpinner />;

export const webKit: WebKit = Object.freeze({
	version: WEB_KIT_VERSION,
	Provider,
	Button,
	TextField,
	Textarea,
	Checkbox,
	Select,
	RadioGroup,
	DatePicker,
	NumberField,
	Notice,
	Card,
	Headline,
	Spinner
});
