/**
 * FE#514 / ADR-016 — Team-Besprechung panel states. Stories drive the pure
 * view (no network/Matrix), mirroring the CaseHandoverCurtain pattern.
 */
import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
	TeamDiscussionPanelView,
	TeamDiscussionPanelViewProps
} from './TeamDiscussionPanel';
import { TeamDiscussionMessage } from './teamDiscussionHelpers';
import './teamDiscussion.styles.scss';

const messages: TeamDiscussionMessage[] = [
	{
		id: '$1',
		senderMatrixId: '@kim:oriso',
		senderDisplayName: 'Kim Gerlander',
		body: 'Die Anfrage klingt nach U25 – wer von euch hätte Kapazität?',
		ts: Date.parse('2026-07-18T09:12:00Z'),
		isOwn: false
	},
	{
		id: '$2',
		senderMatrixId: '@me:oriso',
		senderDisplayName: 'Ich',
		body: 'Ich könnte übernehmen, habe morgen aber erst ab 14 Uhr Zeit.',
		ts: Date.parse('2026-07-18T09:14:00Z'),
		isOwn: true
	},
	{
		id: '$3',
		senderMatrixId: '@alex:oriso',
		senderDisplayName: 'Alex M.',
		body: 'Passt – ich würde vorher kurz die Historie prüfen.',
		ts: Date.parse('2026-07-18T09:17:00Z'),
		isOwn: false
	}
];

const noop = () => undefined;

const baseProps: TeamDiscussionPanelViewProps = {
	discussion: { matrixRoomId: '!demo:oriso', status: 'OPEN' },
	messages,
	isOpen: true,
	draft: '',
	isSending: false,
	error: null,
	onToggle: noop,
	onDraftChange: noop,
	onSend: noop
};

const Interactive = (props: Partial<TeamDiscussionPanelViewProps>) => {
	const [isOpen, setIsOpen] = useState(true);
	const [draft, setDraft] = useState('');
	return (
		<TeamDiscussionPanelView
			{...baseProps}
			{...props}
			isOpen={isOpen}
			draft={draft}
			onToggle={() => setIsOpen(!isOpen)}
			onDraftChange={setDraft}
			onSend={() => setDraft('')}
		/>
	);
};

const meta: Meta<typeof TeamDiscussionPanelView> = {
	title: 'Components/Session/TeamDiscussionPanel',
	component: TeamDiscussionPanelView
};

export default meta;
type Story = StoryObj<typeof TeamDiscussionPanelView>;

export const OpenWithMessages: Story = {
	name: 'Open discussion with team posts',
	render: () => <Interactive />
};

export const NotStartedYet: Story = {
	name: 'No discussion yet (start hint on the enquiry)',
	args: {
		...baseProps,
		discussion: null,
		messages: [],
		isOpen: false
	}
};

export const EmptyDiscussion: Story = {
	name: 'Opened, no posts yet',
	render: () => <Interactive messages={[]} />
};

export const ArchivedReadOnly: Story = {
	name: 'Archived after acceptance (read-only, hard close)',
	args: {
		...baseProps,
		discussion: {
			matrixRoomId: '!demo:oriso',
			status: 'ARCHIVED',
			archiveDate: '2026-07-18T10:00:00Z'
		}
	}
};

export const SendError: Story = {
	name: 'Send failed',
	render: () => (
		<Interactive error={'Die Nachricht konnte nicht gesendet werden.'} />
	)
};
