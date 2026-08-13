import type { Meta, StoryObj } from '@storybook/react';

import { FailedSendTimelineEntry } from './FailedSendTimelineEntry';
import { mockMessageItemComponentProps } from './MessageItemComponent.mocks';
import { phone390Globals, withMessageContexts } from './messageStoryShell';
import './message.styles.scss';

/**
 * What the sender sees when their own message was rejected: the message itself,
 * still visible, followed by the explanation and a retry.
 *
 * The ordering is the point and it is easy to get wrong. The failed message
 * stays **above** the system card, so the person can still read and copy what
 * they wrote — losing the text of a message somebody just composed about
 * something hard is a far worse failure than the send itself. Neither entry is
 * ever sent to Matrix; both live only in the sender's local timeline.
 */
const meta = {
	title: 'Components/Chat/FailedSendTimelineEntry',
	component: FailedSendTimelineEntry,
	tags: ['autodocs'],
	/* This entry renders a real MessageItemComponent, which reads the session,
	   user, E2EE and server-settings contexts. Without them Storybook shows its
	   "needs live app data" placeholder — a story that documents nothing. */
	decorators: [withMessageContexts],
	parameters: {
		layout: 'padded',
		docs: {
			description: {
				component:
					'A rejected outgoing message plus its recovery card. Local to the sender; never transmitted.'
			}
		}
	},
	args: {
		failed: {
			id: 'send-failed-1',
			message: 'Ich weiß gerade nicht mehr weiter.',
			ts: Date.parse('2026-08-07T09:41:00Z'),
			transportMessage: 'Ich weiß gerade nicht mehr weiter.',
			isAside: false,
			mentionedUserIds: []
		},
		messageProps: mockMessageItemComponentProps(),
		onRetry: () => undefined,
		retryPending: false,
		retryDisabled: false
	}
} satisfies Meta<typeof FailedSendTimelineEntry>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The default: retry is offered. */
export const Retryable: Story = {};

/** A retry is in flight — the button must not accept a second click. */
export const RetryPending: Story = { args: { retryPending: true } };

/**
 * Retry is unavailable (no connection, or the room is gone). The message still
 * stays visible; only the affordance is withdrawn.
 */
export const RetryDisabled: Story = { args: { retryDisabled: true } };

/** A long message, to check that nothing is truncated in the failure state. */
export const LongMessage: Story = {
	args: {
		failed: {
			id: 'send-failed-2',
			message:
				'Ich habe lange überlegt, ob ich mich überhaupt melde. Es fällt mir schwer, das aufzuschreiben, und ich möchte nicht, dass es verloren geht.',
			ts: Date.parse('2026-08-07T09:42:00Z'),
			transportMessage: 'lang',
			isAside: false,
			mentionedUserIds: []
		}
	}
};

export const Mobile: Story = { globals: phone390Globals };
