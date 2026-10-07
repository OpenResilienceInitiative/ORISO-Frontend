import * as React from 'react';
import { Meta, StoryObj } from '@storybook/react';
import {
	EmailPage,
	EmailToneRow,
	emailPageArgTypes
} from '../preview/EmailPage';

const meta = {
	title: 'Email/Pages/EinsichtAngefragt',
	component: EmailPage,
	argTypes: emailPageArgTypes,
	args: { id: 'einsicht-angefragt' as const, locale: 'de-sie' as const },
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'A request for temporary supporting access. The protected link opens the request; the current counsellor remains responsible. No private case facts appear in the subject or preview.'
			}
		}
	}
} satisfies Meta<typeof EmailPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Formal: Story = {
	name: 'Deutsch (Sie)',
	args: { locale: 'de-sie' }
};

export const Informal: Story = {
	name: 'Deutsch (du)',
	args: { locale: 'de-du' }
};

export const English: Story = {
	name: 'English',
	args: { locale: 'en' }
};

export const French: Story = { args: { locale: 'fr' } };
export const Russian: Story = { args: { locale: 'ru' } };
export const Turkish: Story = { args: { locale: 'tr' } };
export const Tigrinya: Story = { args: { locale: 'ti' } };

export const AllTones: Story = {
	name: 'All three tones',
	render: (args) => <EmailToneRow id={args.id} />
};

export const PlainText: Story = {
	name: 'text/plain part',
	args: { view: 'text' }
};

export const OnPhone: Story = {
	name: 'Phone (375px)',
	args: { width: 375 }
};

export const OnNarrowPhone: Story = {
	name: 'Narrow phone (320px)',
	args: { width: 320 }
};

export const TenantColours: Story = {
	name: 'Other tenant colours',
	args: { primaryColor: '#1c4f8f', accentColor: '#3a7bd0' }
};

export const AsTemplateFile: Story = {
	name: 'Template file (placeholders)',
	args: { filled: false }
};
