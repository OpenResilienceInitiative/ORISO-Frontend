import * as React from 'react';
import { createRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { MentionList, MentionListRef } from './MentionList';
import type { MentionCandidate } from './mentionFiltering';

const items: MentionCandidate[] = [
	{ id: '1', displayName: 'A. Kräger', username: 'a.kraeger', isInRoom: true },
	{
		id: '2',
		displayName: 'B. Beraterin',
		username: 'beraterin',
		isInRoom: true
	},
	{
		id: '3',
		displayName: 'J. Lehmann',
		username: 'j.lehmann',
		isInRoom: false
	}
];

const meta = {
	title: 'Components/Composer/MentionList',
	component: MentionList,
	tags: ['autodocs'],
	parameters: {
		layout: 'centered',
		docs: {
			description: {
				component:
					'@-mention suggestion popup (Slack-like). Lists agency consultants; those ' +
					'not in the current chat are still selectable but flagged so it is clear ' +
					'the mention pulls them into the conversation.'
			}
		}
	}
} satisfies Meta<typeof MentionList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MixedMembership: Story = {
	render: () => (
		<MentionList
			ref={createRef<MentionListRef>()}
			items={items}
			command={() => {}}
			notInChatLabel="nicht im Chat"
		/>
	)
};

export const AllInChat: Story = {
	render: () => (
		<MentionList
			ref={createRef<MentionListRef>()}
			items={items.filter((i) => i.isInRoom)}
			command={() => {}}
			notInChatLabel="nicht im Chat"
		/>
	)
};
