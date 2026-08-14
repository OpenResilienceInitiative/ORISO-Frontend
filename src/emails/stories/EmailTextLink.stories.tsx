import { Meta, StoryObj } from '@storybook/react';
import { EmailFragment, emailFragmentArgTypes } from '../preview/EmailFragment';
import { emailSecondaryAction } from '../kit/emailMolecules';
import { emailSampleBrand } from '../kit/emailTokens';

const meta = {
	title: 'Email/Atoms/TextLink',
	component: EmailFragment,
	argTypes: emailFragmentArgTypes,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'The optional second action, directly under the button. Always underlined: colour alone is not an affordance, and several clients recolour link text anyway. Only two mails use it — the appointment (map link) and the contact sheet (chat link).'
			}
		}
	}
} satisfies Meta<typeof EmailFragment>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MapLink: Story = {
	args: {
		fragment: emailSecondaryAction(
			{ label: 'Adresse auf der Karte öffnen', href: '{{mapUrl}}' },
			emailSampleBrand
		),
		width: 700
	}
};

export const ChatLink: Story = {
	args: {
		fragment: emailSecondaryAction(
			{ label: 'Zum geschützten Chat', href: '{{messageUrl}}' },
			emailSampleBrand
		),
		width: 700
	}
};

export const OnPhone: Story = {
	args: {
		fragment: emailSecondaryAction(
			{ label: 'Adresse auf der Karte öffnen', href: '{{mapUrl}}' },
			emailSampleBrand
		),
		width: 375
	}
};
