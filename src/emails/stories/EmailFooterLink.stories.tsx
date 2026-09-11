import { Meta, StoryObj } from '@storybook/react';
import { EmailFragment, emailFragmentArgTypes } from '../preview/EmailFragment';
import {
	emailBlock,
	emailFooterLink,
	emailFooterSeparator
} from '../kit/emailAtoms';
import { emailCaptionStyle } from '../kit/emailAtoms';

const meta = {
	title: 'Email/Atoms/FooterLink',
	component: EmailFragment,
	argTypes: emailFragmentArgTypes,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'The legal and settings links, separated by a middot. `white-space:nowrap` keeps each label intact on desktop; below 620px the links become inline blocks and are allowed to wrap, because four of them in a row forced a horizontal scroll at 320px. "Benachrichtigungen abbestellen" is not optional decoration — an unsubscribe path has to be reachable from every notification mail.'
			}
		}
	}
} satisfies Meta<typeof EmailFragment>;

export default meta;
type Story = StoryObj<typeof meta>;

const links = [
	{ label: 'Einstellungen', href: '{{settingsUrl}}' },
	{ label: 'Datenschutz', href: '{{privacyUrl}}' },
	{ label: 'Impressum', href: '{{imprintUrl}}' },
	{ label: 'Benachrichtigungen abbestellen', href: '{{unsubscribeUrl}}' }
];

const row = (items: typeof links) =>
	emailBlock(
		`<div class="flinks">${items
			.map(emailFooterLink)
			.join(emailFooterSeparator())}</div>`,
		{ padding: [28, 40, 28, 40], style: emailCaptionStyle() }
	);

export const Default: Story = {
	args: { fragment: row(links), onCard: false, width: 700 }
};

export const SingleLink: Story = {
	args: { fragment: row(links.slice(0, 1)), onCard: false, width: 700 }
};

export const WrappingOnPhone: Story = {
	name: 'Wrapping on a phone',
	args: { fragment: row(links), onCard: false, width: 375 }
};

export const WrappingOnNarrowPhone: Story = {
	name: 'Wrapping at 320px',
	args: { fragment: row(links), onCard: false, width: 320 }
};
