import type * as React from 'react';

export interface KitProviderProps {
	children: React.ReactNode;
}

export interface KitButtonProps {
	children: React.ReactNode;
	onClick?: () => void;
	variant?: 'primary' | 'secondary' | 'tertiary' | 'link';
	disabled?: boolean;
	id?: string;
	/** Accessible name when the visible content is not enough. */
	title?: string;
	/** `submit` submits the surrounding form, also on Enter; defaults to `button`. */
	type?: 'button' | 'submit';
}

export interface KitTextFieldProps {
	label: string;
	value: string;
	onChange: (value: string) => void;
	helperText?: React.ReactNode;
	error?: boolean;
	disabled?: boolean;
	required?: boolean;
	maxLength?: number;
	placeholder?: string;
	id?: string;
	type?: 'text' | 'email' | 'number' | 'tel' | 'url';
}

export interface KitTextareaProps extends Omit<KitTextFieldProps, 'type'> {
	minRows?: number;
}

export interface KitCheckboxProps {
	label: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
	disabled?: boolean;
	/** id of an element explaining the checkbox. */
	describedBy?: string;
}

export interface KitSelectOption {
	value: string;
	label: string;
	disabled?: boolean;
}

export interface KitSelectProps {
	label: string;
	options: KitSelectOption[];
	value: string;
	onChange: (value: string) => void;
	helperText?: React.ReactNode;
	error?: boolean;
	disabled?: boolean;
	id?: string;
}

export interface KitNoticeProps {
	title: string;
	children?: React.ReactNode;
	type?: 'info' | 'success' | 'warning' | 'error';
}

export interface KitCardProps {
	children: React.ReactNode;
}

export interface KitHeadlineProps {
	/** Plain text; rendered as text, never as HTML. */
	children: string;
	level?: 1 | 2 | 3 | 4 | 5;
	/** Looks like this level while keeping `level` for the document outline. */
	styleLevel?: 1 | 2 | 3 | 4 | 5;
}

export interface WebKit {
	version: string;
	Provider: React.ComponentType<KitProviderProps>;
	Button: React.ComponentType<KitButtonProps>;
	TextField: React.ComponentType<KitTextFieldProps>;
	Textarea: React.ComponentType<KitTextareaProps>;
	Checkbox: React.ComponentType<KitCheckboxProps>;
	Select: React.ComponentType<KitSelectProps>;
	Notice: React.ComponentType<KitNoticeProps>;
	Card: React.ComponentType<KitCardProps>;
	Headline: React.ComponentType<KitHeadlineProps>;
	Spinner: React.ComponentType<Record<string, never>>;
}
