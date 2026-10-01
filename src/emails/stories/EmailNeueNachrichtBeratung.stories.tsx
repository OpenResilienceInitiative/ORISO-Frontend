import * as React from 'react';
import { Meta, StoryObj } from '@storybook/react';
import {
	EmailPage,
	EmailToneRow,
	emailPageArgTypes
} from '../preview/EmailPage';

const meta = {
	title: 'Email/Pages/NeueNachrichtBeratung',
	component: EmailPage,
	argTypes: emailPageArgTypes,
	args: { id: 'neue-nachricht-beratung' as const, locale: 'de-sie' as const },
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'Sent to a consultant when a message arrives in one of their counselling cases. Subject and preview stay neutral and use the configured product name. The body is addressed to the consultant, contains no message content or names, and links to the existing secure message destination. It uses the existing message preference; it does not create another setting.'
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

export const AllTones: Story = {
	name: 'All seven language and tone variants',
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
