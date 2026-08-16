import { Meta, StoryObj } from '@storybook/react';
import { EmailFragment, emailFragmentArgTypes } from '../preview/EmailFragment';
import { emailFooter } from '../kit/emailMolecules';
import { EMAIL_CONTENT } from '../index';
import { emailSampleBrand } from '../kit/emailTokens';

const meta = {
	title: 'Email/Molecules/Footer',
	component: EmailFragment,
	argTypes: emailFragmentArgTypes,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'Sender identity, the "offered by" line, the four legal/settings links, and the do-not-reply note. Sits below the card on the bare canvas, so it reads as envelope rather than message.\n\nThis block is where the Träger becomes legally visible: name, postal address and imprint link are what an Impressumspflicht requires, and they are per-tenant, not per-platform.'
			}
		}
	}
} satisfies Meta<typeof EmailFragment>;

export default meta;
type Story = StoryObj<typeof meta>;

const footerFor = (locale: 'de-sie' | 'de-du' | 'en') =>
	emailFooter(
		EMAIL_CONTENT[locale]['neue-nachricht'].footer,
		emailSampleBrand
	);

export const Formal: Story = {
	name: 'Deutsch (Sie)',
	args: { fragment: footerFor('de-sie'), onCard: false, width: 700 }
};

export const Informal: Story = {
	name: 'Deutsch (du)',
	args: { fragment: footerFor('de-du'), onCard: false, width: 700 }
};

export const English: Story = {
	args: { fragment: footerFor('en'), onCard: false, width: 700 }
};

export const LongOrgName: Story = {
	name: 'Long Träger name',
	args: {
		fragment: emailFooter(
			EMAIL_CONTENT['de-sie']['neue-nachricht'].footer,
			{
				...emailSampleBrand,
				orgName:
					'Caritasverband für die Diözese Mainz e. V., Fachbereich Beratungsdienste'
			}
		),
		onCard: false,
		width: 700
	}
};

export const OnPhone: Story = {
	name: 'Phone — links wrap',
	args: { fragment: footerFor('de-sie'), onCard: false, width: 375 }
};

export const OnNarrowPhone: Story = {
	name: 'Narrow phone (320px)',
	args: { fragment: footerFor('de-sie'), onCard: false, width: 320 }
};

export const AsTemplate: Story = {
	name: 'Template (placeholders)',
	args: {
		fragment: emailFooter(
			EMAIL_CONTENT['de-sie']['neue-nachricht'].footer,
			emailSampleBrand
		),
		onCard: false,
		width: 700,
		filled: false
	}
};
