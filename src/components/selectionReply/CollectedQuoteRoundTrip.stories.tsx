import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor, within } from 'storybook/test';
import { MessageItemComponent } from '../message/MessageItemComponent';
import { MessageContextShell } from '../message/messageStoryShell';
import {
	mockE2eeParams,
	mockMessageItemComponentProps
} from '../message/MessageItemComponent.mocks';
import { formatMatrixTimelineEvent } from '../../utils/matrixTimelineEventFormatter';
import { buildPassageRepliesContent } from './passageReplyContent';

const content = buildPassageRepliesContent(
	[{ eventId: '$original', author: 'Luca', excerpt: 'fddf' }],
	'Das ist meine Antwort im Schreibfeld.',
	{ voice: (seconds) => `[Voice ${seconds}s]` }
);
const event = {
	getType: () => 'm.room.message',
	getContent: () => content,
	getSender: () => '@counsellor:oriso.invalid',
	getId: () => '$answer',
	getTs: () => 1700000000000
};
const formatted = formatMatrixTimelineEvent(
	event,
	null,
	'Verschlüsselte Nachricht'
);
const meta = {
	title: 'Chat/Selection reply/Collected quote round trip',
	component: MessageItemComponent,
	decorators: [
		(Story) => (
			<MessageContextShell>
				<Story />
			</MessageContextShell>
		)
	],
	args: {
		...mockMessageItemComponentProps({
			isMyMessage: true,
			message: formatted.msg
		}),
		passageReplies: formatted.passageReplies,
		handleDecryptionErrors: () => {},
		handleDecryptionSuccess: () => {},
		e2eeParams: mockE2eeParams()
	}
} satisfies Meta<typeof MessageItemComponent>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The stored Matrix payload uses the real formatter, not a hand-built quote. */
export const ComposerTextAfterBareQuote: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await waitFor(() => expect(canvas.getByText('„fddf“')).toBeVisible());
		await expect(
			canvas.getByText('Das ist meine Antwort im Schreibfeld.')
		).toBeVisible();
		await expect(canvasElement.textContent).not.toContain('> fddf');
	}
};

/** Visual reconstruction of the old fallback; no real chat data is used. */
export const BeforeRawFallback: Story = {
	args: { message: String(content.body), passageReplies: null }
};
