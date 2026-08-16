import { Meta, StoryObj } from '@storybook/react';
import { EmailFragment, emailFragmentArgTypes } from '../preview/EmailFragment';
import { emailHeaderBar } from '../kit/emailMolecules';
import { emailSampleBrand } from '../kit/emailTokens';

const meta = {
	title: 'Email/Atoms/LogoLockup',
	component: EmailFragment,
	argTypes: emailFragmentArgTypes,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'36×36 logo plus the platform name, above the card on the bare canvas. The name is real text, not part of the image, so the mail is still identifiable when images are blocked — which is the default in Outlook and in many corporate clients.'
			}
		}
	}
} satisfies Meta<typeof EmailFragment>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		fragment: emailHeaderBar(emailSampleBrand),
		onCard: false,
		width: 700
	}
};

export const LongPlatformName: Story = {
	args: {
		fragment: emailHeaderBar({
			...emailSampleBrand,
			platformName: 'Online-Beratung der Caritas Mainz'
		}),
		onCard: false,
		width: 700
	}
};

export const ImagesBlocked: Story = {
	name: 'Images blocked',
	args: {
		// Deliberately unresolvable, so the story shows what Outlook's default
		// (and every "load images?" prompt) actually renders: the alt text.
		fragment: emailHeaderBar({
			...emailSampleBrand,
			logoUrl: '/deliberately-missing-logo.png'
		}),
		onCard: false,
		width: 700
	}
};

export const OnPhone: Story = {
	args: {
		fragment: emailHeaderBar(emailSampleBrand),
		onCard: false,
		width: 375
	}
};
