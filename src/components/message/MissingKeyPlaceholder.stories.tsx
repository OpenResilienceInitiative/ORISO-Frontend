import * as React from 'react';
import { expect, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react';

import { MissingKeyPlaceholder } from './MissingKeyPlaceholder';
import {
	mobileParameters,
	phone390Globals,
	type MessageStoryParameters,
	withMessageShell
} from './messageStoryShell';
import './message.styles.scss';

/**
 * Honest placeholder for earlier messages this device has no room key for
 * (#1827), for example the history before a case handover. It is not an
 * error: keys only reach devices that existed when a message was sent.
 *
 * Consecutive messages collapse into ONE notice with a count. The wording is
 * neutral on purpose, no "verschlüsselt" and no "Fehler".
 */
const meta = {
	id: 'components-chat-missingkeyplaceholder',
	title: 'Chat/System messages/Missing key',
	component: MissingKeyPlaceholder,
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'`count` is the number of consecutive earlier messages the notice stands for; `dateLabel` carries the date divider of the first of them. The text switches between singular and plural via i18n.'
			}
		}
	},
	args: { count: 1 },
	decorators: [
		(Story, ctx) =>
			withMessageShell(Story, {
				parameters: ctx.parameters as MessageStoryParameters
			})
	]
} satisfies Meta<typeof MissingKeyPlaceholder>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Single: Story = {
	name: 'Single message',
	args: { count: 1 },
	play: async ({ canvasElement }) => {
		const notice = within(canvasElement).getByRole('status');
		await expect(notice).toHaveTextContent(
			'Frühere Nachricht auf diesem Gerät nicht verfügbar'
		);
		await expect(notice).not.toHaveTextContent(/verschlüsselt|Fehler/i);
	}
};

export const Grouped: Story = {
	name: 'Grouped (4 messages)',
	args: { count: 4 },
	play: async ({ canvasElement }) => {
		const notices = within(canvasElement).getAllByRole('status');
		await expect(notices).toHaveLength(1);
		await expect(notices[0]).toHaveTextContent(
			'4 frühere Nachrichten auf diesem Gerät nicht verfügbar'
		);
	}
};

export const WithDateDivider: Story = {
	name: 'With date divider',
	args: { count: 3, dateLabel: 'Heute' },
	play: async ({ canvasElement }) => {
		await expect(
			within(canvasElement).getByRole('separator')
		).toHaveAttribute('aria-label', 'Heute');
	}
};

export const Mobile: Story = {
	name: 'Mobile (390px)',
	args: { count: 4 },
	globals: phone390Globals,
	parameters: {
		...mobileParameters,
		docs: {
			description: {
				story: 'Title and hint wrap inside the card at 390px; nothing overflows.'
			}
		}
	}
};

export const InTimeline: Story = {
	name: 'Between readable messages',
	render: () => (
		<div style={{ display: 'grid', gap: 8 }}>
			<MissingKeyPlaceholder count={5} dateLabel="Montag, 26. Oktober" />
			<MissingKeyPlaceholder count={1} />
		</div>
	)
};
