import { Meta, StoryObj } from '@storybook/react';
import { ZipcodeInput } from './ZipcodeInput';

const meta = {
	title: 'REGISTRATION/ZipcodeInput',
	component: ZipcodeInput,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component: 'ZipcodeInput component for entering postal code during registration. Validates and updates registration data.'
			}
		}
	}
} satisfies Meta<typeof ZipcodeInput>;

export default meta;
type Story = StoryObj<typeof ZipcodeInput>;

export const Default: Story = {
	args: {
		onChange: () => {}
	}
};
