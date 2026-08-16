import { Meta, StoryObj } from '@storybook/react';
import { EmailFragment, emailFragmentArgTypes } from '../preview/EmailFragment';
import {
	emailCallToAction,
	emailFootnote,
	emailSecondaryAction
} from '../kit/emailMolecules';
import { emailSampleBrand } from '../kit/emailTokens';

const meta = {
	title: 'Email/Molecules/ActionGroup',
	component: EmailFragment,
	argTypes: emailFragmentArgTypes,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'Button, optional text link, and the reassuring footnote underneath — the part of the mail that asks for something.\n\nOne primary action per mail, always. The footnote exists to take the pressure back off ("Sie müssen nicht sofort antworten"): in counselling, a notification that reads like a deadline is worse than no notification.'
			}
		}
	}
} satisfies Meta<typeof EmailFragment>;

export default meta;
type Story = StoryObj<typeof meta>;

const primaryOnly =
	emailCallToAction(
		{ label: 'Zur Nachricht', href: '{{messageUrl}}' },
		emailSampleBrand
	) +
	emailFootnote(
		'Sie müssen nicht sofort antworten. Die Nachricht bleibt in Ihrem Postfach, solange Sie sie brauchen.'
	);

const withSecondary =
	emailCallToAction(
		{ label: 'Termin ansehen', href: '{{appointmentUrl}}' },
		emailSampleBrand
	) +
	emailSecondaryAction(
		{ label: 'Adresse auf der Karte öffnen', href: '{{mapUrl}}' },
		emailSampleBrand
	) +
	emailFootnote(
		'Sie erhalten 24 Stunden vorher eine Erinnerung. Absagen ist jederzeit möglich.'
	);

export const PrimaryOnly: Story = {
	args: { fragment: primaryOnly, width: 700 }
};

export const WithSecondaryLink: Story = {
	args: { fragment: withSecondary, width: 700 }
};

export const OnPhone: Story = {
	name: 'Phone — button spans the column',
	args: { fragment: withSecondary, width: 375 }
};

export const OnNarrowPhone: Story = {
	name: 'Narrow phone (320px)',
	args: { fragment: withSecondary, width: 320 }
};
