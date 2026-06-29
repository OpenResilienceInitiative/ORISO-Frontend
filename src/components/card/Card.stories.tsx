import React from 'react';
import { Meta, StoryObj } from '@storybook/react';
import { Card } from './';

const meta = {
	title: 'Atoms/Card',
	component: Card,
	tags: ['autodocs'],
	parameters: {
		docs: { description: { component: 'Card container with optional Header, Content and Footer sub-sections.' } }
	}
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	render: () => (
		<Card>
			<span>Simple card content</span>
		</Card>
	)
};

export const WithSections: Story = {
	render: () => (
		<Card>
			<Card.Header>Card title</Card.Header>
			<Card.Content>Some descriptive body text inside the card.</Card.Content>
			<Card.Footer>Footer area</Card.Footer>
		</Card>
	)
};
