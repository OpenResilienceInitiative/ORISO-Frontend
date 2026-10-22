import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { ConversationPreview } from './ConversationPreview';
import { setMatrixClientServiceRef } from '../../services/matrixClientRegistry';
import { MessageContextShell } from '../message/messageStoryShell';
import { composerHtmlToTransportMarkup } from '../messageSubmitInterface/composerTransportEncoding';
import type { PreviewCapabilities } from './previewCapabilities';

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
		await waitFor(() =>
			expect(
				canvasElement.querySelectorAll(
					'.conversationPreview__header [data-cy="participant-avatar"]'
				)
			).toHaveLength(2)
		);
		for (const avatar of canvasElement.querySelectorAll(
			'.conversationPreview__header [data-cy="participant-avatar"]'
		)) {
			await expect(Math.round(avatar.getBoundingClientRect().width)).toBe(
				48
			);
		}
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

/* #929: a room with more history than the first page. The fake client holds
   the newest 50 events; one server page adds 6 older ones, then history ends. */
const seedLongRoom = () => {
	writeCalls.length = 0;
	const timeline: any[] = Array.from({ length: 50 }, (_, index) =>
		fakeEvent(
			`$new${index}`,
			index % 2 ? '@marge:oriso' : '@lisa:oriso',
			`Neuere Nachricht ${index + 1}`,
			300 - index * 5
		)
	);
	let token: string | null = 'older-page';
	const room = {
		roomId: '!long:oriso',
		timeline,
		getMember: (senderId: string) => ({
			name: NAMES[senderId] || senderId
		}),
		getLiveTimeline: () => ({
			getPaginationToken: () => token,
			getEvents: () => timeline
		})
	};
	setMatrixClientServiceRef({
		getClient: () => ({
			getUserId: () => '@marge:oriso',
			getRoom: () => room,
			on: () => undefined,
			off: () => undefined,
			removeListener: () => undefined,
			// Reading older history is the only call paging makes.
			scrollback: () =>
				new Promise((resolve) => {
					setTimeout(() => {
						timeline.unshift(
							...Array.from({ length: 6 }, (_, index) =>
								fakeEvent(
									`$old${index}`,
									'@lisa:oriso',
									`Ältere Nachricht ${index + 1}`,
									600 - index * 5
								)
							)
						);
						token = null;
						resolve(room);
					}, 400);
				}),
			sendReadReceipt: recordWrite('sendReadReceipt'),
			sendReceipt: recordWrite('sendReceipt'),
			setRoomReadMarkers: recordWrite('setRoomReadMarkers'),
			sendEvent: recordWrite('sendEvent')
		}),
		waitUntilReady: () => Promise.resolve(),
		getRoomMessages: (_roomId: string, limit: number) =>
			timeline.slice(-limit)
	} as any);
};

export const OlderMessages: Story = {
	decorators: [
		(StoryComponent) => {
			seedLongRoom();
			return (
				<div style={{ height: 480, width: 412, display: 'flex' }}>
					<StoryComponent />
				</div>
			);
		}
	],
	args: { roomId: '!long:oriso' },
	parameters: {
		docs: {
			description: {
				story: '#929: the newest 50 messages render first. "Load older messages" fetches one bounded page through the chat\'s own paging, prepends it without moving the visible rows, and is replaced by "Start of the conversation" when no history remains. Nothing marks the room read.'
			}
		}
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await canvas.findByText('Neuere Nachricht 50');
		await expect(canvas.queryByText('Ältere Nachricht 1')).toBeNull();
		const list = canvasElement.querySelector<HTMLElement>(
			'.conversationPreview__messages'
		);
		const button = canvasElement.querySelector<HTMLButtonElement>(
			'.conversationPreview__loadOlder'
		);
		await expect(button).not.toBeNull();
		// Reader scrolls to the top; what they see must stay in place. (The
		// first row itself may lose its header once an older row from the
		// same sender sits above it, so measure a row a little further down.)
		list!.scrollTop = 0;
		const watchedRow = canvasElement.querySelector<HTMLElement>(
			'[data-message-id="$new5"]'
		);
		const before = watchedRow!.getBoundingClientRect().top;
		await userEvent.click(button!);
		await waitFor(() =>
			expect(
				canvasElement
					.querySelector('.conversationPreview__loadOlder')
					?.getAttribute('aria-busy')
			).toBe('true')
		);
		await canvas.findByText('Ältere Nachricht 1');
		const ids = Array.from(
			canvasElement.querySelectorAll<HTMLElement>('[data-message-id]')
		).map((row) => row.dataset.messageId);
		await expect(ids.slice(0, 7)).toEqual([
			'$old0',
			'$old1',
			'$old2',
			'$old3',
			'$old4',
			'$old5',
			'$new0'
		]);
		await expect(ids).toHaveLength(56);
		const after = canvasElement
			.querySelector<HTMLElement>('[data-message-id="$new5"]')!
			.getBoundingClientRect().top;
		await expect(Math.abs(after - before)).toBeLessThan(2);
		await expect(
			canvasElement.querySelector('.conversationPreview__historyStart')
		).not.toBeNull();
		await expect(
			canvasElement.querySelector('.conversationPreview__loadOlder')
		).toBeNull();
		await expect(writeCalls).toEqual([]);
	}
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
			canvasElement.querySelector(
				'.conversationPreview__header [data-cy="participant-avatar"]'
			)
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
				canvasElement.querySelectorAll(
					'.conversationPreview__header [data-cy="participant-avatar"]'
				)
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
				canvasElement.querySelectorAll(
					'.conversationPreview__header [data-cy="participant-avatar"]'
				)
			).toHaveLength(1)
		);
		await expect(
			canvasElement.querySelector('[data-cy="participant-overflow"]')
		).toHaveTextContent('+5');
	}
};

/* #1824: the writable preview. The same chat rows, now with the message menu,
   live reactions and a composer — still without anything that leaves the
   Timeline, and without writing anything merely by opening. */
const WRITABLE: PreviewCapabilities = {
	composer: true,
	react: true,
	manageOwn: true,
	readOnlyReason: null
};

const writableConversation =
	(width: number | string): NonNullable<Story['decorators']>[number] =>
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
				'',
				40,
				{
					'm.relates_to': {
						rel_type: 'm.annotation',
						event_id: '$2',
						key: '❤️'
					}
				},
				'm.reaction'
			),
			fakeEvent('$4', '@lisa:oriso', 'Danke, das tut gut.', 12)
		]);
		return (
			<div style={{ height: 560, width, display: 'flex' }}>
				<StoryComponent />
			</div>
		);
	};

const expectNothingWrittenOnOpen = async (canvasElement: HTMLElement) => {
	const canvas = within(canvasElement);
	await waitFor(() =>
		expect(
			canvas.getByRole('textbox', {
				name: /notifications\.center\.preview\.inputLabel|Antwort|reply/i
			})
		).toBeInTheDocument()
	);
	// Opening alone: no receipt, no read marker, no event.
	await expect(writeCalls).toEqual([]);
};

export const Writable: Story = {
	decorators: [writableConversation(640)],
	args: { roomId: '!preview:oriso', capabilities: WRITABLE },
	play: async ({ canvasElement }) => {
		await expectNothingWrittenOnOpen(canvasElement);
	}
};

export const WritablePhone: Story = {
	decorators: [writableConversation('100%')],
	globals: { viewport: { value: 'phone390' } },
	args: { roomId: '!preview:oriso', capabilities: WRITABLE },
	play: async ({ canvasElement }) => {
		await expectNothingWrittenOnOpen(canvasElement);
		// The composer fits the phone width: nothing is cut off.
		const composer = canvasElement.querySelector(
			'.conversationPreview__composer'
		) as HTMLElement;
		await expect(composer.scrollWidth).toBeLessThanOrEqual(
			composer.clientWidth + 1
		);
	}
};

export const ReadOnlyArchived: Story = {
	decorators: [writableConversation(640)],
	args: {
		roomId: '!preview:oriso',
		capabilities: {
			composer: false,
			react: false,
			manageOwn: false,
			readOnlyReason: 'archived'
		},
		openConversationHref: '/sessions/consultant/sessionView'
	},
	play: async ({ canvasElement }) => {
		await waitFor(() =>
			expect(canvasElement.querySelector('.messageItem')).not.toBeNull()
		);
		await expect(canvasElement.querySelector('textarea')).toBeNull();
		await expect(
			canvasElement.querySelector('.messageItem__kebabButton')
		).toBeNull();
	}
};

export const SupervisorReactOnly: Story = {
	decorators: [writableConversation(640)],
	args: {
		roomId: '!preview:oriso',
		capabilities: {
			composer: false,
			react: true,
			manageOwn: false,
			readOnlyReason: 'supervisor'
		}
	},
	play: async ({ canvasElement }) => {
		await waitFor(() =>
			expect(
				canvasElement.querySelector('button.messageItem__reactionPill')
			).not.toBeNull()
		);
		await expect(canvasElement.querySelector('textarea')).toBeNull();
		await expect(
			canvasElement.querySelector('.messageItem__kebabButton')
		).toBeNull();
	}
};
