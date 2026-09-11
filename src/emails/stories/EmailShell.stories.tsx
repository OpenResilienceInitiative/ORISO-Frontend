import { Meta, StoryObj } from '@storybook/react';
import { EmailFragment, emailFragmentArgTypes } from '../preview/EmailFragment';
import {
	emailAssurance,
	emailCallToAction,
	emailFooter,
	emailFootnote,
	emailHeaderBar,
	emailProse,
	emailTitleGroup
} from '../kit/emailMolecules';
import { emailCard } from '../kit/emailOrganisms';
import { EMAIL_CONTENT } from '../index';
import { EmailBrand, emailSampleBrand } from '../kit/emailTokens';

const meta = {
	title: 'Email/Organisms/Shell',
	component: EmailFragment,
	argTypes: emailFragmentArgTypes,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'Canvas, centred 600px column, header bar, card, footer — everything except the words. This is what a mail is *made of*, and what a new occasion inherits for free.\n\nThe column carries both the legacy `width="600"` attribute (for Outlook\'s Word renderer) and `max-width` (for everything else). Below 620px `.wrap` releases the fixed width and the canvas padding drops from 12px to 8px, so a 320px screen spends its width on content instead of margins.'
			}
		}
	}
} satisfies Meta<typeof EmailFragment>;

export default meta;
type Story = StoryObj<typeof meta>;

const content = EMAIL_CONTENT['de-sie']['neue-nachricht'];

const shell = (brand: EmailBrand) =>
	emailHeaderBar(brand) +
	emailCard(
		emailTitleGroup(content.headline, brand) +
			emailProse(content.paragraphs) +
			emailCallToAction(content.cta, brand) +
			(content.footnote ? emailFootnote(content.footnote) : '') +
			emailAssurance(content.assurance)
	) +
	emailFooter(content.footer, brand);

export const Default: Story = {
	args: { fragment: shell(emailSampleBrand), onCard: false, width: 700 }
};

export const WideViewport: Story = {
	name: 'Wide viewport (column stays 600px)',
	args: { fragment: shell(emailSampleBrand), onCard: false, width: 900 }
};

export const AtTheBreakpoint: Story = {
	name: 'At the breakpoint (620px)',
	args: { fragment: shell(emailSampleBrand), onCard: false, width: 620 }
};

export const OnPhone: Story = {
	args: { fragment: shell(emailSampleBrand), onCard: false, width: 375 }
};

export const OnNarrowPhone: Story = {
	name: 'Narrow phone (320px)',
	args: { fragment: shell(emailSampleBrand), onCard: false, width: 320 }
};

export const OtherTenant: Story = {
	name: 'Other tenant brand',
	args: {
		fragment: shell({
			...emailSampleBrand,
			platformName: 'Beratung Online',
			orgName: 'Diakonisches Werk Hessen und Nassau',
			primaryColor: '#1c4f8f',
			accentColor: '#3a7bd0'
		}),
		onCard: false,
		width: 700
	}
};
