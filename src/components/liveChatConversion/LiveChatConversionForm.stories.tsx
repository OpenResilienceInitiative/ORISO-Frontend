import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { LiveChatConversionForm } from './LiveChatConversionForm';

const meta: Meta<typeof LiveChatConversionForm> = {
	title: 'Live Chat/Keep account',
	component: LiveChatConversionForm,
	args: {
		loginName: 'synthetic-guest',
		busy: false,
		onSubmit: fn()
	}
};
export default meta;
type Story = StoryObj<typeof meta>;
export const Ready: Story = {};
export const Retry: Story = {
	args: { error: 'The account could not be saved. Please try again.' }
};
