import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import { ConversationPreview } from './ConversationPreview';
import { setMatrixClientServiceRef } from '../../services/matrixClientRegistry';
import { MessageContextShell } from '../message/messageStoryShell';
import { composerHtmlToTransportMarkup } from '../messageSubmitInterface/composerTransportEncoding';

const minutesAgo = (minutes: number) => Date.now() - minutes * 60 * 1000;

const fakeEvent = (
	id: string,
	sender: string,
	body: string,
	minutes: number,
	extraContent: Record<string, unknown> = {},
	type = 'm.room.message'
) => ({
	getType: () => type,
	getClearContent: () => ({ msgtype: 'm.text', body, ...extraContent }),
	getContent: () => ({ msgtype: 'm.text', body, ...extraContent }),
	getSender: () => sender,
	getTs: () => minutesAgo(minutes),
	getId: () => id
});

const NAMES: Record<string, string> = {
	'@lisa:oriso': 'Neugieriger Fuchs 42',
	'@marge:oriso': 'Marge Bouvier'
};

/* Every write the real chat performs on open. The story counts them so the
   play test can prove the preview performs none (#420). */
const writeCalls: string[] = [];
const recordWrite = (name: string) => () => {
	writeCalls.push(name);
	return Promise.resolve({});
};

const seedRegistry = (events: any[], roomExists = true) => {
	writeCalls.length = 0;
	const room = roomExists
		? {
				roomId: '!preview:oriso',
				getMember: (senderId: string) => ({
					name: NAMES[senderId] || senderId
				})
			}
		: null;
	setMatrixClientServiceRef({
		getClient: () => ({
			getUserId: () => '@marge:oriso',
			getRoom: () => room,
			on: () => undefined,
			off: () => undefined,
			removeListener: () => undefined,
			sendReadReceipt: recordWrite('sendReadReceipt'),
			sendReceipt: recordWrite('sendReceipt'),
			setRoomReadMarkers: recordWrite('setRoomReadMarkers'),
			sendEvent: recordWrite('sendEvent')
		}),
		getRoomMessages: () => events
	} as any);
};

const meta: Meta<typeof ConversationPreview> = {
	title: 'Organisms/ConversationPreview',
	component: ConversationPreview,
	decorators: [
		(StoryComponent) => (
			<MessageContextShell>
				<StoryComponent />
			</MessageContextShell>
		)
	],
	parameters: {
		docs: {
			description: {
				component:
					'#420: the Activity Timeline detail pane shows the conversation with the real chat rows (bubbles, formatting incl. alignment, avatars, reactions, thread entries) but read-only: no composer, no message actions, no reacting, and no active-view registration, read receipt or mark-read.'
			}
		}
	}
};
export default meta;

type Story = StoryObj<typeof ConversationPreview>;

export const FilledConversation: Story = {
	decorators: [
		(StoryComponent) => {
			seedRegistry([
				fakeEvent(
					'$1',
					'@lisa:oriso',
					'Hallo, ich weiß gerade nicht weiter. Kann ich mit jemandem sprechen?',
					48
				),
				fakeEvent(
					'$2',
					'@marge:oriso',
					'Natürlich — schön, dass Sie sich melden. Erzählen Sie in Ruhe.',
					44
				),
				fakeEvent(
					'$3',
					'@lisa:oriso',
					'Es geht um die Situation zu Hause. Seit ein paar Wochen wird alles zu viel.',
					40
				),
				fakeEvent(
					'$5',
					'@marge:oriso',
					composerHtmlToTransportMarkup(
						'<p style="text-align: center;"><strong>Wichtig:</strong> Sie sind nicht allein.</p>'
					),
					30
				),
				fakeEvent('$6', '@lisa:oriso', 'Danke, das tut gut.', 28, {
					'm.relates_to': {
						rel_type: 'm.thread',
						event_id: '$5'
					}
				}),
				fakeEvent(
					'$7',
					'@lisa:oriso',
					'',
					27,
					{
						'm.relates_to': {
							rel_type: 'm.annotation',
							event_id: '$5',
							key: '❤️'
						}
					},
					'm.reaction'
				),
				fakeEvent('$4', '@lisa:oriso', 'Anhang', 12, {
					msgtype: 'm.file',
					url: 'mxc://oriso/abc',
					info: { mimetype: 'application/pdf', size: 12345 },
					body: 'unterlagen.pdf'
				})
			]);
			return (
				<div style={{ height: 480, width: 640, display: 'flex' }}>
					<StoryComponent />
				</div>
			);
		}
	],
	args: { roomId: '!preview:oriso' },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		// The chat's own rows, not a separate plain-text list.
		await expect(
			canvasElement.querySelectorAll('.messageItem').length
		).toBeGreaterThan(3);
		await expect(
			await canvas.findByText(
				'Natürlich — schön, dass Sie sich melden. Erzählen Sie in Ruhe.'
			)
		).toBeInTheDocument();
		// Formatting and alignment render; the internal marker never shows.
		const aligned = canvasElement.querySelector(
			'.messageItem__align--center'
		);
		await expect(aligned).not.toBeNull();
		await expect(aligned?.querySelector('strong')).not.toBeNull();
		await expect(canvasElement.textContent).not.toContain('[[align');
		// Reactions and the thread entry are visible but not interactive.
		const pill = canvasElement.querySelector('.messageItem__reactionPill');
		await expect(pill?.textContent).toContain('❤️');
		await expect(pill?.tagName).not.toBe('BUTTON');
		const thread = canvasElement.querySelector('[data-cy="thread-entry"]');
		await expect(thread?.textContent).toContain('Danke, das tut gut.');
		await expect(thread?.tagName).not.toBe('BUTTON');
		// Read-only: no composer, no message menu.
		await expect(canvasElement.querySelector('textarea')).toBeNull();
		await expect(
			canvasElement.querySelector('[contenteditable="true"]')
		).toBeNull();
		await expect(
			canvasElement.querySelector('.messageItem__kebabButton')
		).toBeNull();
		// Nothing tells the server "this person is reading".
		await expect(writeCalls).toEqual([]);
	}
};

export const RoomNotSynced: Story = {
	decorators: [
		(StoryComponent) => {
			seedRegistry([], false);
			return (
				<div style={{ height: 320, width: 640, display: 'flex' }}>
					<StoryComponent />
				</div>
			);
		}
	],
	args: { roomId: '!missing:oriso' }
};
