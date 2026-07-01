import { Meta, StoryObj } from '@storybook/react';
import {
	LanguageSelectDropdown,
	MENUPLACEMENT_BOTTOM,
	SelectOption
} from './LanguageSelectDropdown';

const languageOptions: SelectOption[] = [
	{ value: 'de', label: 'Deutsch', iconLabel: 'DE' },
	{ value: 'en', label: 'English', iconLabel: 'EN' },
	{ value: 'fr', label: 'Français', iconLabel: 'FR' },
	{ value: 'ru', label: 'Русский', iconLabel: 'RU' }
];

const meta = {
	title: 'Molecules/LanguageSelectDropdown',
	component: LanguageSelectDropdown,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'A react-select based dropdown for choosing a language, with optional icon labels, multi-select, search and configurable menu placement.'
			}
		}
	}
} satisfies Meta<typeof LanguageSelectDropdown>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		id: 'language-select-default',
		selectedOptions: languageOptions,
		defaultValue: languageOptions[1],
		menuPlacement: MENUPLACEMENT_BOTTOM,
		handleDropdownSelect: () => {}
	}
};

export const WithIcons: Story = {
	args: {
		id: 'language-select-icons',
		selectedOptions: languageOptions,
		defaultValue: languageOptions[0],
		menuPlacement: MENUPLACEMENT_BOTTOM,
		useIconOption: true,
		isSearchable: true,
		handleDropdownSelect: () => {}
	}
};

export const MultiSelect: Story = {
	args: {
		id: 'language-select-multi',
		selectedOptions: languageOptions,
		defaultValue: [languageOptions[0], languageOptions[1]],
		menuPlacement: MENUPLACEMENT_BOTTOM,
		isMulti: true,
		isClearable: true,
		handleDropdownSelect: () => {}
	}
};

export const WithError: Story = {
	args: {
		id: 'language-select-error',
		selectedOptions: languageOptions,
		menuPlacement: MENUPLACEMENT_BOTTOM,
		hasError: true,
		errorMessage: 'Please select a language.',
		handleDropdownSelect: () => {}
	}
};
