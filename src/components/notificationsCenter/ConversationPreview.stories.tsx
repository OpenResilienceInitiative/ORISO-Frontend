import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor } from 'storybook/test';
import { ConversationPreview } from './ConversationPreview';
import { setMatrixClientServiceRef } from '../../services/matrixClientRegistry';

const minutesAgo = (minutes: number) => Date.now() - minutes * 60 * 1000;

const fakeEvent = (
	id: string,
	sender: string,
	body: string,
	minutes: number,
	extraContent: Record<string, unknown> = {}
) => ({
	getType: () => 'm.room.message',
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

const seedRegistry = (events: any[], roomExists = true) => {
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
			off: () => undefined
		}),
		getRoomMessages: () => events
	} as any);
};

const meta: Meta<typeof ConversationPreview> = {
	title: 'Organisms/ConversationPreview',
	component: ConversationPreview
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
				fakeEvent('$4', '@lisa:oriso', 'Anhang', 12, {
					msgtype: 'm.file',
					url: 'mxc://oriso/abc',
					info: { mimetype: 'application/pdf', size: 12345 },
					body: 'unterlagen.pdf'
				})
			]);
			return (
				<div
					style={{
						height: 480,
						maxWidth: 640,
						width: '100%',
						display: 'flex'
					}}
				>
					<StoryComponent />
				</div>
			);
		}
	],
	args: { roomId: '!preview:oriso' },
	play: async ({ canvasElement }) => {
		await waitFor(() =>
			expect(
				canvasElement.querySelectorAll('[data-cy="participant-avatar"]')
			).toHaveLength(2)
		);
		for (const avatar of canvasElement.querySelectorAll(
			'[data-cy="participant-avatar"]'
		)) {
			await expect(Math.round(avatar.getBoundingClientRect().width)).toBe(
				40
			);
		}
		await expect(
			canvasElement.querySelectorAll('.conversationPreview__message')
		).toHaveLength(4);
	}
};

export const RoomNotSynced: Story = {
	decorators: [
		(StoryComponent) => {
			seedRegistry([], false);
			return (
				<div
					style={{
						height: 320,
						maxWidth: 640,
						width: '100%',
						display: 'flex'
					}}
				>
					<StoryComponent />
				</div>
			);
		}
	],
	args: { roomId: '!missing:oriso' }
};

/** No guessed participants while the room's message slice is empty. */
export const EmptyConversation: Story = {
	decorators: [
		(StoryComponent) => {
			seedRegistry([]);
			return (
				<div style={{ height: 320, width: '100%', display: 'flex' }}>
					<StoryComponent />
				</div>
			);
		}
	],
	args: { roomId: '!preview:oriso' },
	play: async ({ canvasElement }) => {
		await expect(
			canvasElement.querySelector('[data-cy="participant-avatar"]')
		).toBeNull();
	}
};

const previewAuthors = (count: number): Story['decorators'] => [
	(StoryComponent) => {
		seedRegistry(
			Array.from({ length: count }, (_, i) =>
				fakeEvent(
					`$author-${i}`,
					`@author-${i}:oriso`,
					`Message ${i + 1}`,
					count - i
				)
			)
		);
		return (
			<div
				style={{
					height: 480,
					maxWidth: 640,
					width: '100%',
					display: 'flex'
				}}
			>
				<StoryComponent />
			</div>
		);
	}
];

export const ManyVisibleAuthors: Story = {
	decorators: previewAuthors(6),
	args: { roomId: '!preview:oriso' },
	play: async ({ canvasElement }) => {
		await waitFor(() =>
			expect(
				canvasElement.querySelectorAll('[data-cy="participant-avatar"]')
			).toHaveLength(4)
		);
		await expect(
			canvasElement.querySelector('[data-cy="participant-overflow"]')
		).toHaveTextContent('+2');
	}
};

export const ManyVisibleAuthorsPhone: Story = {
	decorators: previewAuthors(6),
	globals: { viewport: { value: 'phone390' } },
	args: { roomId: '!preview:oriso' },
	play: async ({ canvasElement }) => {
		await waitFor(() =>
			expect(
				canvasElement.querySelectorAll('[data-cy="participant-avatar"]')
			).toHaveLength(1)
		);
		await expect(
			canvasElement.querySelector('[data-cy="participant-overflow"]')
		).toHaveTextContent('+5');
	}
};
