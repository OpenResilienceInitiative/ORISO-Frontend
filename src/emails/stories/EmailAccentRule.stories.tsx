import { Meta, StoryObj } from '@storybook/react';
import { EmailFragment, emailFragmentArgTypes } from '../preview/EmailFragment';
import { emailAccentRule, emailBlock } from '../kit/emailAtoms';
import { emailSampleBrand } from '../kit/emailTokens';

const meta = {
	title: 'Email/Atoms/AccentRule',
	component: EmailFragment,
	argTypes: emailFragmentArgTypes,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'A 44×4px stroke in the tenant accent colour, sitting above every headline. Drawn as a table cell rather than an image so it survives Outlook and blocked-image settings. Purely decorative — it carries no meaning a screen reader would need.'
			}
		}
	}
} satisfies Meta<typeof EmailFragment>;

export default meta;
type Story = StoryObj<typeof meta>;

const rule = (accentColor: string) =>
	emailBlock(emailAccentRule({ ...emailSampleBrand, accentColor }), {
		padding: [36, 40, 36, 40]
	});

export const Default: Story = {
	args: { fragment: rule(emailSampleBrand.accentColor), width: 700 }
};

export const TenantAccent: Story = {
	name: 'Other tenant accent',
	args: { fragment: rule('#3a7bd0'), width: 700 }
};

export const OnPhone: Story = {
	args: { fragment: rule(emailSampleBrand.accentColor), width: 375 }
};
