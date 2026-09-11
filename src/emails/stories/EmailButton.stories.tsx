import { Meta, StoryObj } from '@storybook/react';
import { EmailFragment, emailFragmentArgTypes } from '../preview/EmailFragment';
import { emailCallToAction } from '../kit/emailMolecules';
import { emailSampleBrand } from '../kit/emailTokens';

const meta = {
	title: 'Email/Atoms/Button',
	component: EmailFragment,
	argTypes: emailFragmentArgTypes,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'The one primary action of a mail. Bulletproof pattern: a single-cell table carries the fill and the pill radius, because Outlook drops `border-radius` from an `<a>`. Below 620px the wrapper table is stretched to 100% and the anchor becomes a block, so the tap target spans the full column — the first draft set `display:block` on the anchor alone, which did nothing while its wrapper was still shrink-to-fit.'
			}
		}
	}
} satisfies Meta<typeof EmailFragment>;

export default meta;
type Story = StoryObj<typeof meta>;

const button = (label: string, href = '{{messageUrl}}') =>
	emailCallToAction({ label, href }, emailSampleBrand);

export const Default: Story = {
	args: { fragment: button('Zur Nachricht'), width: 700 }
};

export const LongLabel: Story = {
	args: { fragment: button('Zur Beratung anmelden'), width: 700 }
};

export const OtherTenantColour: Story = {
	name: 'Other tenant colour',
	args: {
		fragment: emailCallToAction(
			{ label: 'Termin buchen', href: '{{bookingUrl}}' },
			{ ...emailSampleBrand, primaryColor: '#0a6a53' }
		),
		width: 700
	}
};

export const OnPhone: Story = {
	name: 'Phone — full width',
	args: { fragment: button('Zur Beratung anmelden'), width: 375 }
};

export const OnNarrowPhone: Story = {
	name: 'Narrow phone (320px)',
	args: { fragment: button('Zur Beratung anmelden'), width: 320 }
};
