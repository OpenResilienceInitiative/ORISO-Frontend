import { Meta, StoryObj } from '@storybook/react';
import { EmailFragment, emailFragmentArgTypes } from '../preview/EmailFragment';
import { emailBlock, emailHeadline } from '../kit/emailAtoms';

const meta = {
	title: 'Email/Atoms/Headline',
	component: EmailFragment,
	argTypes: emailFragmentArgTypes,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'The single `<h1>` of the mail. M3 headline size 24/32 at weight 500, dropping to 22/30 below 620px. Written as a statement of what happened, never as a command — "Sie haben eine neue Nachricht", not "Jetzt lesen".'
			}
		}
	}
} satisfies Meta<typeof EmailFragment>;

export default meta;
type Story = StoryObj<typeof meta>;

const headline = (text: string) =>
	emailBlock(emailHeadline(text), { padding: [36, 40, 36, 40] });

export const Default: Story = {
	args: { fragment: headline('Sie haben eine neue Nachricht'), width: 700 }
};

export const TwoLines: Story = {
	name: 'Wraps to two lines',
	args: {
		fragment: headline(
			'So erreichen Sie Ihre Beratung telefonisch und online'
		),
		width: 700
	}
};

export const OnPhone: Story = {
	name: 'Phone (22/30)',
	args: { fragment: headline('Sie haben eine neue Nachricht'), width: 375 }
};

export const OnNarrowPhone: Story = {
	name: 'Narrow phone (320px)',
	args: {
		fragment: headline(
			'So erreichen Sie Ihre Beratung telefonisch und online'
		),
		width: 320
	}
};
