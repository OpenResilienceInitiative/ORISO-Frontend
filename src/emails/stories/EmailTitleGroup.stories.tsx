import { Meta, StoryObj } from '@storybook/react';
import { EmailFragment, emailFragmentArgTypes } from '../preview/EmailFragment';
import { emailProse, emailTitleGroup } from '../kit/emailMolecules';
import { emailSampleBrand } from '../kit/emailTokens';

const meta = {
	title: 'Email/Molecules/TitleGroup',
	component: EmailFragment,
	argTypes: emailFragmentArgTypes,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'Accent rule plus headline — the opening of every card. The rule is the only place the tenant accent colour appears in the body, which is what keeps a themed mail recognisable without turning the copy into brand colour. Shown here with the first paragraph so the vertical rhythm is judgeable.'
			}
		}
	}
} satisfies Meta<typeof EmailFragment>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		fragment:
			emailTitleGroup('Sie haben eine neue Nachricht', emailSampleBrand) +
			emailProse([
				'In Ihrer Beratung bei {{platformName}} liegt eine neue Nachricht für Sie bereit.'
			]),
		width: 700
	}
};

export const LongHeadline: Story = {
	args: {
		fragment:
			emailTitleGroup(
				'So erreichen Sie Ihre Beratung',
				emailSampleBrand
			) +
			emailProse([
				'Neben dem geschützten Chat können Sie Ihre Beratung auch telefonisch erreichen oder direkt einen Termin buchen.'
			]),
		width: 700
	}
};

export const OtherTenantAccent: Story = {
	name: 'Other tenant accent',
	args: {
		fragment:
			emailTitleGroup('Ihr Termin ist bestätigt', {
				...emailSampleBrand,
				accentColor: '#12a17c'
			}) + emailProse(['Wir haben Ihren Termin notiert.']),
		width: 700
	}
};

export const OnPhone: Story = {
	args: {
		fragment:
			emailTitleGroup('Sie haben eine neue Nachricht', emailSampleBrand) +
			emailProse([
				'In Ihrer Beratung bei {{platformName}} liegt eine neue Nachricht für Sie bereit.'
			]),
		width: 375
	}
};
