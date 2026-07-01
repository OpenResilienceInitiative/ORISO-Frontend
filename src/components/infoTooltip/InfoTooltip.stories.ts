import { Meta, StoryObj } from '@storybook/react';
import { InfoTooltip } from './InfoTooltip';

const meta = {
	title: 'Molecules/InfoTooltip',
	component: InfoTooltip,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'An info icon that reveals a name/description tooltip on hover, focus or click.'
			}
		}
	}
} satisfies Meta<typeof InfoTooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		info: {
			id: 1,
			name: 'Online counselling',
			description:
				'Get confidential support from a trained counsellor via secure chat.'
		},
		translation: { prefix: 'agency.info', ns: 'agencies' }
	}
};

export const ProfileView: Story = {
	args: {
		info: {
			id: 2,
			name: 'Anonymous',
			description: 'Your identity stays private throughout the conversation.'
		},
		translation: { prefix: 'agency.info', ns: 'agencies' },
		isProfileView: true
	}
};
