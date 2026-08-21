import * as React from 'react';
import { Meta, StoryObj } from '@storybook/react';
import {
	EmailPage,
	EmailToneRow,
	emailPageArgTypes
} from '../preview/EmailPage';

const meta = {
	title: 'Email/Pages/Termin',
	component: EmailPage,
	argTypes: emailPageArgTypes,
	args: { id: 'termin' as const, locale: 'de-sie' as const },
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'Appointment confirmation. One of only two mails allowed to name the counselling centre, because the recipient booked it themselves. The busiest data panel of the set, and therefore the sharpest test of the mobile stacking rule — check the 320px story.'
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
