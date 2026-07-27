import type { Meta, StoryObj } from '@storybook/react-vite';
import { DoNotDisturbControlView } from './DoNotDisturbControl';

const meta: Meta<typeof DoNotDisturbControlView> = {
	title: 'Profile/DoNotDisturbControl',
	component: DoNotDisturbControlView,
	args: { onSelect: () => {} }
};
export default meta;
type Story = StoryObj<typeof DoNotDisturbControlView>;

export const Off: Story = { args: { dndUntil: null } };

export const Active: Story = {
	name: 'Active (until +1h)',
	args: { dndUntil: new Date(Date.now() + 3600_000).toISOString() }
};
