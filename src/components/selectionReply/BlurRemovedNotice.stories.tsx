import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { ICON_INFO, SystemMessage } from '../message/SystemMessage';
import { PassageReplyBlocks } from './PassageReplyBlocks';
import {
	phone390Globals,
	type MessageStoryParameters,
	withMessageShell
} from '../message/messageStoryShell';
import '../message/message.styles.scss';

/**
 * ORISO-Frontend#2494 *9 (P0 v2.0.18): removing a redaction (Schwärzung)
 * no longer shows "Diese Nachricht wurde gelöscht.". The history shows a
 * system notice "Schwärzung aufgehoben von <Name>" with the passage in the
 * existing reply-quote display; the quote itself is the click area that
 * jumps to the message (as in the selectionReply Jump/round-trip stories).
 * No separate "Zur Nachricht springen" link. The message is readable again.
 *
 * Components: `SystemMessage` (message/SystemMessage, info icon) and
 * `PassageReplyBlocks` (selectionReply/PassageReplyBlocks, `onJump`).
 */
const NAME = 'Karina P';

const Notice = ({ onJump }: { onJump: () => void }) => (
	<SystemMessage
		icon={ICON_INFO}
		subject={<>Schwärzung aufgehoben von {NAME}</>}
	>
		<PassageReplyBlocks
			replies={[
				{
					eventId: '$message-1',
					author: 'Sanftes Alpaka Kala',
					excerpt: 'meine Adresse ist Lindenstraße 12'
				}
			]}
			onJump={onJump}
		/>
	</SystemMessage>
);

const meta = {
	id: 'p0-v2018-9-blur-removed',
	title: 'P0 v2.0.18/*9 Schwärzung aufgehoben',
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'#2494 *9: system notice "Schwärzung aufgehoben von <Name>" instead of "gelöschte Nachricht"; the quoted passage (reply-quote display) jumps to the message.'
			}
		}
	},
	args: { onJump: fn() },
	render: (args) => <Notice onJump={args.onJump} />,
	decorators: [
		(Story, ctx) =>
			withMessageShell(Story, {
				parameters: ctx.parameters as MessageStoryParameters
			})
	]
} satisfies Meta<{ onJump: () => void }>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The notice; a click on the quote jumps to the message. */
export const Notice1440: Story = {
	name: 'Hinweis mit Sprung zur Nachricht · 1440',
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByText(`Schwärzung aufgehoben von ${NAME}`)
		).toBeVisible();
		await userEvent.click(
			canvas.getByRole('button', { name: /Zur zitierten Stelle/ })
		);
		await expect(args.onJump).toHaveBeenCalled();
	}
};

/** The same on a phone. */
export const Notice390: Story = {
	name: 'Hinweis mit Sprung zur Nachricht · 390',
	globals: phone390Globals
};
