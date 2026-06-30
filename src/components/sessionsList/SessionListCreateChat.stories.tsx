import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { SessionListCreateChat } from './SessionListCreateChat';
import './sessionsList.styles.scss';
import '../sessionsListItem/sessionsListItem.styles.scss';

const meta = {
	title: 'Components/Session/List/SessionListCreateChat',
	component: SessionListCreateChat,
	tags: ['autodocs'],
	parameters: {
		layout: 'centered',
		backgrounds: { default: 'gray' },
		docs: {
			description: {
				component:
					'Highlighted list row when the consultant is on **Neuer Chat** / create group chat route. Uses `sessionsListItem` + `createChatItem` classes.'
			}
		}
	}
} satisfies Meta<typeof SessionListCreateChat>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	decorators: [
		(StoryEl) => (
			<div
				style={{
					backgroundColor: '#eae7e8',
					padding: 16,
					minWidth: 360
				}}
			>
				<StoryEl />
			</div>
		)
	]
};
