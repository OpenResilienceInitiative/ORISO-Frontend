import { Meta, StoryObj } from '@storybook/react';
import { EmailFragment, emailFragmentArgTypes } from '../preview/EmailFragment';
import { emailAssurance } from '../kit/emailMolecules';
import { EMAIL_CONTENT } from '../index';

const meta = {
	title: 'Email/Molecules/Assurance',
	component: EmailFragment,
	argTypes: emailFragmentArgTypes,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'Divider plus the end-to-end encryption promise, closing every card.\n\nIt is repeated in every mail on purpose. The mail itself is the one part of the product that is *not* encrypted and *not* behind a login, so it is exactly where the promise has to be restated — and where a recipient can check it without signing in.'
			}
		}
	}
} satisfies Meta<typeof EmailFragment>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Formal: Story = {
	name: 'Deutsch (Sie)',
	args: {
		fragment: emailAssurance(
			EMAIL_CONTENT['de-sie']['neue-nachricht'].assurance
		),
		width: 700
	}
};

export const Informal: Story = {
	name: 'Deutsch (du)',
	args: {
		fragment: emailAssurance(
			EMAIL_CONTENT['de-du']['neue-nachricht'].assurance
		),
		width: 700
	}
};

export const English: Story = {
	args: {
		fragment: emailAssurance(EMAIL_CONTENT.en['neue-nachricht'].assurance),
		width: 700
	}
};

export const OnPhone: Story = {
	args: {
		fragment: emailAssurance(
			EMAIL_CONTENT['de-sie']['neue-nachricht'].assurance
		),
		width: 375
	}
};
