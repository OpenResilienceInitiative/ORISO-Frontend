import type { Meta, StoryObj } from '@storybook/react';
import { MessageDateDivider } from './MessageDateDivider';

const meta = {
	title: 'Components/Chat/MessageDateDivider',
	component: MessageDateDivider,
	tags: ['autodocs'],
	parameters: {
		layout: 'padded',
		design: {
			type: 'figma',
			url: 'https://www.figma.com/design/L2mOFNSGdxPPx1XA4HFAog/App.Oriso?node-id=7539-29134'
		}
	}
} satisfies Meta<typeof MessageDateDivider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Today: Story = {
	name: 'Heute',
	args: { label: 'Heute' }
};

export const ExplicitDate: Story = {
	name: 'Explicit date',
	args: { label: '7. Juli 2026' }
};

export const LongLabel: Story = {
	name: 'Long label',
	args: { label: 'Montag, 7. Juli 2026 — Beginn der Beratung' }
};
