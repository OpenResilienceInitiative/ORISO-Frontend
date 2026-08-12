import * as React from 'react';
import { createRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { MentionList, MentionListRef } from './MentionList';
import type { MentionCandidate } from './mentionFiltering';

const items: MentionCandidate[] = [
	{
		id: '1',
		displayName: 'A. Kräger',
		username: 'a.kraeger',
		isInRoom: true
	},
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

export const MixedMembership: StoryObj = {
	render: () => (
		<MentionList
			ref={createRef<MentionListRef>()}
			items={items}
			command={() => {}}
			notInChatLabel="nicht im Chat"
		/>
	)
};

export const AllInChat: StoryObj = {
	render: () => (
		<MentionList
			ref={createRef<MentionListRef>()}
			items={items.filter((i) => i.isInRoom)}
			command={() => {}}
			notInChatLabel="nicht im Chat"
		/>
	)
};

/*
 * #993 — an empty popup used to render nothing at all, so a failed request
 * and "nobody matches" were the same silent blank. Each cause now says so.
 */
const emptyLabels = {
	notInChatLabel: 'nicht im Chat',
	emptyLabel: 'Niemand gefunden',
	unavailableLabel: 'Liste konnte nicht geladen werden',
	loadingLabel: 'Wird geladen …'
};

export const NobodyMatches: StoryObj = {
	name: 'Empty — nobody matches the query',
	render: () => (
		<MentionList
			ref={createRef<MentionListRef>()}
			items={[]}
			command={() => {}}
			directoryState="ready"
			{...emptyLabels}
		/>
	)
};

export const DirectoryUnavailable: StoryObj = {
	name: 'Empty — the consultant list could not be loaded',
	render: () => (
		<MentionList
			ref={createRef<MentionListRef>()}
			items={[]}
			command={() => {}}
			directoryState="error"
			{...emptyLabels}
		/>
	)
};

export const DirectoryLoading: StoryObj = {
	name: 'Empty — the consultant list is still loading',
	render: () => (
		<MentionList
			ref={createRef<MentionListRef>()}
			items={[]}
			command={() => {}}
			directoryState="loading"
			{...emptyLabels}
		/>
	)
};
