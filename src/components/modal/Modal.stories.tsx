import React from 'react';
import { Meta, StoryObj } from '@storybook/react';
import { Modal } from './Modal';

const meta = {
	title: 'Atoms/Modal',
	component: Modal,
	tags: ['autodocs'],
	parameters: { docs: { description: { component: 'Modal container that wraps arbitrary content in a styled dialog box.' } } }
} satisfies Meta<typeof Modal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	render: () => (
		<Modal>
			<span>Modal content goes here.</span>
		</Modal>
	)
};

export const WithCustomClass: Story = {
	render: () => (
		<Modal className="custom-modal">
			<span>Modal with an extra CSS class applied.</span>
		</Modal>
	)
};
