import * as React from 'react';
import { AppThemeProvider } from '../../resources/scripts/AppThemeProvider';
import {
	BUTTON_TYPES,
	Button as CoreButton
} from '../../components/button/Button';
import { OrisoTextField } from '../../components/form/OrisoTextField';
import { OrisoTextarea } from '../../components/form/OrisoTextarea';
import { OrisoSelect } from '../../components/form/OrisoSelect';
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
	KitHeadlineProps,
	KitNoticeProps,
	KitProviderProps,
	KitSelectProps,
	KitTextareaProps,
	KitTextFieldProps,
	WebKit
} from './types';

export * from './types';

export const WEB_KIT_VERSION = '1.0.0';

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
	Notice,
	Card,
	Headline,
	Spinner
});
