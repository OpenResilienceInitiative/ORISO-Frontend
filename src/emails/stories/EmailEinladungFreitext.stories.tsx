import * as React from 'react';
import { Meta, StoryObj } from '@storybook/react';
import {
	EmailPage,
	EmailToneRow,
	emailPageArgTypes
} from '../preview/EmailPage';

const meta = {
	title: 'Email/Pages/EinladungFreitext',
	component: EmailPage,
	argTypes: emailPageArgTypes,
	args: { id: 'einladung-freitext' as const, locale: 'de-sie' as const },
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'The ORISO frame around an invitation the operator wrote themselves. Subject and body are theirs; UserService inserts the sanitised body into {{bodyHtml}} and expands {{ctaBlock}} into the "Einladung annehmen" button plus a copy-link fallback. Ships in the plain dialect only.'
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

export const AsTemplateFile: Story = {
	name: 'Template file (placeholders)',
	args: { filled: false }
};
