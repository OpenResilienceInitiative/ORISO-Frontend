import React from 'react';
import { Meta, StoryObj } from '@storybook/react-vite';
import { Modal } from './Modal';
import { Spinner } from '../spinner/Spinner';

const meta = {
	title: 'Atoms/Modal',
	component: Modal,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'Modal container that wraps arbitrary content in a styled dialog box.'
			}
		}
	}
} satisfies Meta<typeof Modal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		children: <span>Modal content goes here.</span>
	},
	render: () => (
		<Modal>
			<span>Modal content goes here.</span>
		</Modal>
	)
};

export const WithCustomClass: Story = {
	args: {
		children: <span>Modal with an extra CSS class applied.</span>,
		className: 'custom-modal'
	},
	render: () => (
		<Modal className="custom-modal">
			<span>Modal with an extra CSS class applied.</span>
		</Modal>
	)
};

/** The app's tenant theme loader uses this surface and the neutral spinner. */
export const ThemeLoading: Story = {
	args: {
		children: (
			<div>
				<Spinner isDark />
			</div>
		)
	}
};
