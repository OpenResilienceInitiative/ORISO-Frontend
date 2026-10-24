// @vitest-environment jsdom
import * as React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { setMatrixClientServiceRef } from '../../services/matrixClientRegistry';
import { composerHtmlToTransportMarkup } from '../messageSubmitInterface/composerTransportEncoding';

const transport = vi.hoisted(() => ({
	getMatrixRoom: vi.fn(),
	getMatrixRoomMessages: vi.fn(),
	// #929: the history the client holds, and the chat's own paging call.
	getMatrixRoomHistoryState: vi.fn(() => ({
		cachedCount: 0,
		hasMoreOnServer: false
	})),
	loadEarlierMatrixRoomMessages: vi.fn(async () => false),
	onMatrixTimeline: vi.fn(() => () => undefined),
	// Read paths the message rows use to resolve member names (as in the chat).
	resolveSession: (session: any) => ({ matrixRoomId: session?.rid }),
	loadMatrixRoomMembers: vi.fn(async () => []),
	onMatrixRoomMembers: vi.fn(() => () => undefined),
	// Write paths the real chat uses. The preview must never touch them.
	markRoomAsRead: vi.fn(async () => undefined),
	sendReaction: vi.fn(async () => undefined),
	redactEvent: vi.fn(async () => undefined)
}));
const activeView = vi.hoisted(() => vi.fn(async () => undefined));

// The real chatTransportService imports matrix-js-sdk (heavyweight, hangs the
// jsdom worker). vi.mock calls are hoisted above the imports by vitest.
vi.mock('../../services/chatTransportService', () => ({
	chatTransportService: transport
}));
// The chat's "is reading" registration (#847 root cause).
vi.mock('../../api/apiPatchNotificationActiveView', () => ({
	apiPatchNotificationActiveView: activeView
}));
// lottie-web asks for a 2d canvas context at import time.
vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('lottie-web', () => ({ default: { loadAnimation: () => ({}) } }));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, fallback?: unknown) =>
			typeof fallback === 'string' ? fallback : key,
		i18n: { language: 'de' }
	}),
	Trans: ({ children }: { children?: React.ReactNode }) => <>{children}</>
}));

HTMLCanvasElement.prototype.getContext = (() => ({
	fillRect: () => {},
	getImageData: () => ({ data: new Uint8ClampedArray(4) }),
	putImageData: () => {},
	measureText: () => ({ width: 0 }),
	fillText: () => {}
})) as unknown as HTMLCanvasElement['getContext'];

const OWN = '@consultant:matrix.example';
const LISA = '@lisa:matrix.example';

const matrixEvent = (overrides: {
	id: string;
	sender: string;
	body?: string;
	type?: string;
	content?: Record<string, unknown>;
	ts?: number;
}) => {
	const content = overrides.content ?? {
		msgtype: 'm.text',
		body: overrides.body ?? ''
	};
	return {
		getType: () => overrides.type ?? 'm.room.message',
		getClearContent: () => content,
		getContent: () => content,
		getSender: () => overrides.sender,
		getTs: () => overrides.ts ?? 1754040000000,
		getId: () => overrides.id
	};
};

const room = {
	roomId: '!room:matrix.example',
	getMember: (senderId: string) => ({
		name: senderId.split(':')[0].substring(1)
	})
};

const matrixClient = {
	getUserId: () => OWN,
	sendReadReceipt: vi.fn(),
	setRoomReadMarkers: vi.fn(),
	sendReceipt: vi.fn()
};

/** `events` is the room's live timeline, oldest first, like the SDK's. */
const arrange = (events: any[], roomExists = true, hasMoreOnServer = false) => {
	transport.getMatrixRoom.mockReturnValue(roomExists ? room : null);
	transport.getMatrixRoomMessages.mockImplementation(
		(_roomId: string, limit: number) => events.slice(-limit)
	);
	const server = { hasMore: hasMoreOnServer };
	transport.getMatrixRoomHistoryState.mockImplementation(() => ({
		cachedCount: events.length,
		hasMoreOnServer: server.hasMore
	}));
	setMatrixClientServiceRef({ getClient: () => matrixClient } as any);
	return server;
};

const textEvents = (prefix: string, count: number, sender = LISA) =>
	Array.from({ length: count }, (_, index) =>
		matrixEvent({
			id: `$${prefix}${index}`,
			sender,
			body: `${prefix} message ${index}`
		})
	);

let ConversationPreview: typeof import('./ConversationPreview').ConversationPreview;
let MessageContextShell: typeof import('../message/messageStoryShell').MessageContextShell;

beforeAll(async () => {
	// MessageItemComponent is a big module graph; load it once.
	// Allow cold transforms on a busy development machine; assertions keep their normal timeouts.
	({ ConversationPreview } = await import('./ConversationPreview'));
	({ MessageContextShell } = await import('../message/messageStoryShell'));
}, 180000);

const renderPreview = (props: { roomId: string; threadRootId?: string }) =>
	render(
		<MessageContextShell>
			<ConversationPreview {...props} />
		</MessageContextShell>
	);

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
	setMatrixClientServiceRef(null);
});

describe('ConversationPreview (#420): the real chat rows, read-only', () => {
	it('renders the room through the chat message rows', () => {
		arrange([
			matrixEvent({
				id: '$1',
				sender: LISA,
				body: 'Hallo, ich brauche Hilfe.'
			}),
			matrixEvent({ id: '$2', sender: OWN, body: 'Gern, erzählen Sie.' })
		]);

		const { container } = renderPreview({
			roomId: '!room:matrix.example'
		});

		expect(container.querySelectorAll('.messageItem')).toHaveLength(2);
		expect(screen.getByText('Hallo, ich brauche Hilfe.')).toBeTruthy();
		// Own message sits on the right, exactly like in the chat.
		expect(
			container
				.querySelector('[data-message-id="$2"]')
				?.classList.contains('messageItem--right')
		).toBe(true);
	});

	it('renders formatting and alignment as the chat does, never the [[align]] marker', () => {
		const markup = composerHtmlToTransportMarkup(
			'<p style="text-align: center;"><strong>Zentriert</strong></p>'
		);
		expect(markup).toContain('[[align:center]]');
		arrange([matrixEvent({ id: '$a', sender: LISA, body: markup })]);

		const { container } = renderPreview({
			roomId: '!room:matrix.example'
		});

		const aligned = container.querySelector('.messageItem__align--center');
		expect(aligned?.textContent).toContain('Zentriert');
		expect(aligned?.querySelector('strong')).toBeTruthy();
		expect(container.textContent).not.toContain('[[align');
	});

	it('shows reactions and thread entries, but none of them can act', () => {
		arrange([
			matrixEvent({ id: '$root', sender: LISA, body: 'Frage' }),
			matrixEvent({
				id: '$t1',
				sender: OWN,
				content: {
					'msgtype': 'm.text',
					'body': 'Antwort im Thread',
					'm.relates_to': { rel_type: 'm.thread', event_id: '$root' }
				}
			}),
			matrixEvent({
				id: '$r1',
				sender: OWN,
				type: 'm.reaction',
				content: {
					'm.relates_to': {
						rel_type: 'm.annotation',
						event_id: '$root',
						key: '👍'
					}
				}
			})
		]);

		const { container } = renderPreview({
			roomId: '!room:matrix.example'
		});

		const pill = container.querySelector('.messageItem__reactionPill');
		expect(pill?.textContent).toContain('👍');
		expect(pill?.tagName).not.toBe('BUTTON');
		const threadEntry = container.querySelector('[data-cy="thread-entry"]');
		expect(threadEntry?.textContent).toContain('Antwort im Thread');
		expect(threadEntry?.tagName).not.toBe('BUTTON');
		// Shared static modifier: no pointer cursor, no hover highlight.
		expect(
			threadEntry?.classList.contains('messageItem__threadButton--static')
		).toBe(true);
	});

	it('renders no composer and no message actions', () => {
		arrange([
			matrixEvent({ id: '$1', sender: LISA, body: 'Hallo' }),
			matrixEvent({ id: '$2', sender: OWN, body: 'Antwort' })
		]);

		const { container } = renderPreview({
			roomId: '!room:matrix.example'
		});

		expect(container.querySelector('textarea')).toBeNull();
		expect(container.querySelector('[contenteditable="true"]')).toBeNull();
		expect(container.querySelector('.messageItem__kebabButton')).toBeNull();
		expect(screen.queryByLabelText('message.menu.open')).toBeNull();
		// Not even a context-menu / long-press path to the action menu.
		const bubble = container.querySelector('.messageItem__message');
		bubble?.dispatchEvent(
			new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
		);
		expect(
			container.ownerDocument.querySelector('[role="menu"]')
		).toBeNull();
	});

	it('never registers an active view, sends a receipt or marks anything read', () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		arrange([
			matrixEvent({ id: '$1', sender: LISA, body: 'Hi' }),
			matrixEvent({ id: '$2', sender: OWN, body: 'Hallo' })
		]);

		renderPreview({ roomId: '!room:matrix.example' });

		// It does listen to the client's live timeline …
		expect(transport.onMatrixTimeline).toHaveBeenCalledWith(
			'!room:matrix.example',
			expect.any(Function)
		);
		// … and writes nothing at all.
		expect(activeView).not.toHaveBeenCalled();
		expect(transport.markRoomAsRead).not.toHaveBeenCalled();
		expect(transport.sendReaction).not.toHaveBeenCalled();
		expect(matrixClient.sendReadReceipt).not.toHaveBeenCalled();
		expect(matrixClient.setRoomReadMarkers).not.toHaveBeenCalled();
		expect(matrixClient.sendReceipt).not.toHaveBeenCalled();
		expect(
			fetchSpy.mock.calls.every(
				([url, options]) =>
					String(url).startsWith('/static/anon-animals/') && !options
			)
		).toBe(true);
		fetchSpy.mockRestore();
	});

	it('shows the thread root and its replies when a thread is selected', () => {
		const threadReply = (id: string, body: string, root: string) =>
			matrixEvent({
				id,
				sender: LISA,
				content: {
					'msgtype': 'm.text',
					'body': body,
					'm.relates_to': { rel_type: 'm.thread', event_id: root }
				}
			});
		arrange([
			matrixEvent({ id: '$root', sender: LISA, body: 'Thread-Anfang' }),
			matrixEvent({ id: '$main', sender: LISA, body: 'Anderes Thema' }),
			threadReply('$t1', 'Reply in our thread', '$root'),
			threadReply('$t2', 'Reply in another thread', '$other')
		]);

		renderPreview({
			roomId: '!room:matrix.example',
			threadRootId: '$root'
		});

		expect(screen.getByText('Thread-Anfang')).toBeTruthy();
		expect(screen.getByText('Reply in our thread')).toBeTruthy();
		expect(screen.queryByText('Reply in another thread')).toBeNull();
		expect(screen.queryByText('Anderes Thema')).toBeNull();
	});

	it('shows the unavailable notice when the room is not in the client store', () => {
		arrange([], false);

		renderPreview({ roomId: '!missing:matrix.example' });

		expect(
			screen.getByText('notifications.center.preview.unavailable')
		).toBeTruthy();
	});

	it('shows the empty state for a room without messages', () => {
		arrange([]);

		renderPreview({ roomId: '!room:matrix.example' });

		expect(
			screen.getByText('notifications.center.preview.empty')
		).toBeTruthy();
	});
});

describe('ConversationPreview (#929): loading older messages on request', () => {
	const ROOM = '!room:matrix.example';
	const LOAD = 'notifications.center.preview.loadOlder';
	const START = 'notifications.center.preview.historyStart';

	it('says the conversation starts here when the client has no older history', () => {
		arrange(textEvents('new', 3));

		renderPreview({ roomId: ROOM });

		expect(screen.getByText(START)).toBeTruthy();
		expect(screen.queryByRole('button', { name: LOAD })).toBeNull();
	});

	it('loads one older page through the chat paging call and prepends it in order', async () => {
		const timeline = textEvents('new', 50);
		const server = arrange(timeline, true, true);
		transport.loadEarlierMatrixRoomMessages.mockImplementation(async () => {
			// The SDK prepends the older page to the same live timeline.
			timeline.unshift(...textEvents('old', 3));
			server.hasMore = false;
			return false;
		});

		const { container } = renderPreview({ roomId: ROOM });
		expect(screen.queryByText('old message 0')).toBeNull();

		await act(async () => {
			fireEvent.click(screen.getByRole('button', { name: LOAD }));
		});

		await screen.findByText('old message 0');
		expect(transport.loadEarlierMatrixRoomMessages).toHaveBeenCalledTimes(
			1
		);
		expect(transport.loadEarlierMatrixRoomMessages).toHaveBeenCalledWith(
			ROOM
		);
		const ids = Array.from(
			container.querySelectorAll<HTMLElement>('[data-message-id]')
		).map((row) => row.dataset.messageId);
		expect(ids.slice(0, 4)).toEqual(['$old0', '$old1', '$old2', '$new0']);
		expect(ids).toHaveLength(53);
		// End of history: the control is replaced by a plain notice.
		expect(screen.getByText(START)).toBeTruthy();
		expect(screen.queryByRole('button', { name: LOAD })).toBeNull();
	});

	it('shows older messages the client already holds without a network page', async () => {
		arrange(textEvents('msg', 60));

		renderPreview({ roomId: ROOM });
		expect(screen.queryByText('msg message 0')).toBeNull();

		fireEvent.click(screen.getByRole('button', { name: LOAD }));

		await screen.findByText('msg message 0');
		expect(transport.loadEarlierMatrixRoomMessages).not.toHaveBeenCalled();
		expect(screen.getByText(START)).toBeTruthy();
	});

	it('shows each event once across the cache and page boundary', async () => {
		const timeline = textEvents('new', 50);
		const server = arrange(timeline, true, true);
		transport.loadEarlierMatrixRoomMessages.mockImplementation(async () => {
			// A page that overlaps the cached window must not double rows.
			timeline.unshift(...textEvents('old', 2), timeline[0]);
			server.hasMore = false;
			return false;
		});

		const { container } = renderPreview({ roomId: ROOM });
		await act(async () => {
			fireEvent.click(screen.getByRole('button', { name: LOAD }));
		});
		await screen.findByText('old message 0');

		expect(
			container.querySelectorAll('[data-message-id="$new0"]')
		).toHaveLength(1);
		expect(container.querySelectorAll('[data-message-id]')).toHaveLength(
			52
		);
	});

	it('shows a busy, disabled control while a page loads', async () => {
		let finish: (hasMore: boolean) => void = () => undefined;
		const timeline = textEvents('new', 50);
		arrange(timeline, true, true);
		transport.loadEarlierMatrixRoomMessages.mockImplementation(
			() =>
				new Promise<boolean>((resolve) => {
					finish = resolve;
				})
		);

		renderPreview({ roomId: ROOM });
		fireEvent.click(screen.getByRole('button', { name: LOAD }));

		const busy = await screen.findByRole('button', {
			name: 'notifications.center.preview.loadingOlder'
		});
		expect(busy.hasAttribute('disabled')).toBe(true);
		expect(busy.getAttribute('aria-busy')).toBe('true');
		// A second click while busy starts no second request.
		fireEvent.click(busy);
		expect(transport.loadEarlierMatrixRoomMessages).toHaveBeenCalledTimes(
			1
		);

		await act(async () => finish(true));
		expect(await screen.findByRole('button', { name: LOAD })).toBeTruthy();
	});

	it('reports a failed page and retries on request', async () => {
		const timeline = textEvents('new', 50);
		const server = arrange(timeline, true, true);
		transport.loadEarlierMatrixRoomMessages
			.mockRejectedValueOnce(new Error('network'))
			.mockImplementationOnce(async () => {
				timeline.unshift(...textEvents('old', 1));
				server.hasMore = false;
				return false;
			});

		renderPreview({ roomId: ROOM });
		fireEvent.click(screen.getByRole('button', { name: LOAD }));

		const alert = await screen.findByRole('alert');
		expect(alert.textContent).toContain(
			'notifications.center.preview.loadOlderFailed'
		);
		// Messages already shown stay visible.
		expect(screen.getByText('new message 49')).toBeTruthy();

		await act(async () => {
			fireEvent.click(
				screen.getByRole('button', {
					name: 'notifications.center.preview.retryLoadOlder'
				})
			);
		});

		await screen.findByText('old message 0');
		expect(transport.loadEarlierMatrixRoomMessages).toHaveBeenCalledTimes(
			2
		);
		expect(screen.queryByRole('alert')).toBeNull();
	});

	it('never marks the room read, sends a receipt or registers a view while paging', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		const timeline = textEvents('new', 50);
		const server = arrange(timeline, true, true);
		transport.loadEarlierMatrixRoomMessages.mockImplementation(async () => {
			timeline.unshift(...textEvents('old', 2));
			server.hasMore = true;
			return true;
		});

		renderPreview({ roomId: ROOM });
		fireEvent.click(screen.getByRole('button', { name: LOAD }));
		await screen.findByText('old message 0');
		fireEvent.click(screen.getByRole('button', { name: LOAD }));
		await waitFor(() =>
			expect(
				transport.loadEarlierMatrixRoomMessages
			).toHaveBeenCalledTimes(2)
		);

		expect(activeView).not.toHaveBeenCalled();
		expect(transport.markRoomAsRead).not.toHaveBeenCalled();
		expect(matrixClient.sendReadReceipt).not.toHaveBeenCalled();
		expect(matrixClient.setRoomReadMarkers).not.toHaveBeenCalled();
		expect(matrixClient.sendReceipt).not.toHaveBeenCalled();
		expect(
			fetchSpy.mock.calls.every(
				([url, options]) =>
					String(url).startsWith('/static/anon-animals/') && !options
			)
		).toBe(true);
		fetchSpy.mockRestore();
	});

	it('keeps the visible messages in place when older ones are prepended', async () => {
		// jsdom has no layout: give every row 100px so heights are measurable.
		const height = Object.getOwnPropertyDescriptor(
			HTMLElement.prototype,
			'scrollHeight'
		);
		Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
			configurable: true,
			get(this: HTMLElement) {
				return this.querySelectorAll('[data-message-id]').length * 100;
			}
		});
		try {
			const timeline = textEvents('new', 50);
			const server = arrange(timeline, true, true);
			transport.loadEarlierMatrixRoomMessages.mockImplementation(
				async () => {
					timeline.unshift(...textEvents('old', 4));
					server.hasMore = true;
					return true;
				}
			);

			renderPreview({ roomId: ROOM });
			const list = screen.getByTestId('conversation-preview');
			// Opened at the newest message; the reader then scrolls up a bit.
			expect(list.scrollTop).toBe(5000);
			list.scrollTop = 1200;

			fireEvent.click(screen.getByRole('button', { name: LOAD }));
			await screen.findByText('old message 0');

			// 4 rows × 100px were added above: the same rows stay in view.
			expect(list.scrollTop).toBe(1600);
		} finally {
			if (height) {
				Object.defineProperty(
					HTMLElement.prototype,
					'scrollHeight',
					height
				);
			}
		}
	});

	it('offers older history for a thread whose rows are not cached yet', async () => {
		const timeline = textEvents('new', 50);
		const server = arrange(timeline, true, true);
		transport.loadEarlierMatrixRoomMessages.mockImplementation(async () => {
			timeline.unshift(
				matrixEvent({
					id: '$root',
					sender: LISA,
					body: 'Thread-Anfang'
				})
			);
			server.hasMore = false;
			return false;
		});

		renderPreview({ roomId: ROOM, threadRootId: '$root' });
		expect(
			screen.getByText('notifications.center.preview.empty')
		).toBeTruthy();

		fireEvent.click(screen.getByRole('button', { name: LOAD }));

		await screen.findByText('Thread-Anfang');
	});
});

describe('ConversationPreview: approved author header', () => {
	it('shows canonical header avatars only for visible message authors, latest first', () => {
		arrange([
			matrixEvent({
				id: '$1',
				sender: '@lisa:matrix.example',
				body: 'Older',
				ts: 1
			}),
			matrixEvent({
				id: '$2',
				sender: '@consultant:matrix.example',
				body: 'Latest',
				ts: 2
			}),
			matrixEvent({
				id: '$3',
				sender: '@lisa:matrix.example',
				body: 'Again',
				ts: 1
			})
		]);
		const { container } = renderPreview({ roomId: '!room:matrix.example' });
		const avatars = container.querySelectorAll(
			'.conversationPreview__header [data-cy="participant-avatar"]'
		);
		expect(
			Array.from(avatars).map((avatar) =>
				avatar.getAttribute('data-user-id')
			)
		).toEqual(['@consultant:matrix.example', '@lisa:matrix.example']);
		expect(
			container.querySelector('.participantStack')?.getAttribute('style')
		).toContain('--participant-size: 48px');
	});

	it('updates preview authors on timeline events without exposing technical members', () => {
		arrange([
			matrixEvent({
				id: '$1',
				sender: '@lisa:matrix.example',
				body: 'First',
				ts: 1
			})
		]);
		const { container } = renderPreview({ roomId: '!room:matrix.example' });
		transport.getMatrixRoomMessages.mockReturnValue([
			matrixEvent({
				id: '$2',
				sender: '@consultant:matrix.example',
				body: 'New',
				ts: 2
			})
		]);
		act(() => (transport.onMatrixTimeline.mock.calls[0] as any)[1]());
		expect(
			container
				.querySelector(
					'.conversationPreview__header [data-cy="participant-avatar"]'
				)
				?.getAttribute('data-user-id')
		).toBe('@consultant:matrix.example');
		expect(
			container.querySelector('[data-user-id="@silent:matrix.example"]')
		).toBeNull();
	});
	it('excludes system, group-chat and agency service senders from the preview header', () => {
		arrange([
			matrixEvent({
				id: '$human',
				sender: '@lisa:matrix.example',
				body: 'Visible person'
			}),
			matrixEvent({
				id: '$system',
				sender: '@system:matrix.example',
				body: 'Notice'
			}),
			matrixEvent({
				id: '$group-system',
				sender: '@group-chat-system-40:matrix.example',
				body: 'Group notice'
			}),
			matrixEvent({
				id: '$agency',
				sender: '@agency-12-service:matrix.example',
				body: 'Agency notice'
			})
		]);
		const { container } = renderPreview({ roomId: '!room:matrix.example' });
		expect(
			Array.from(
				container.querySelectorAll(
					'.conversationPreview__header [data-cy="participant-avatar"]'
				)
			).map((avatar) => avatar.getAttribute('data-user-id'))
		).toEqual(['@lisa:matrix.example']);
	});
	it('limits thread-header identities to that thread and excludes unrelated authors', () => {
		arrange([
			matrixEvent({
				id: '$other',
				sender: '@unrelated:matrix.example',
				body: 'Other discussion'
			}),
			matrixEvent({ id: '$root', sender: LISA, body: 'Root' }),
			matrixEvent({
				id: '$reply',
				sender: OWN,
				content: {
					'msgtype': 'm.text',
					'body': 'Reply',
					'm.relates_to': { rel_type: 'm.thread', event_id: '$root' }
				}
			})
		]);
		const { container } = renderPreview({
			roomId: '!room:matrix.example',
			threadRootId: '$root'
		});
		expect(
			Array.from(
				container.querySelectorAll(
					'.conversationPreview__header [data-user-id]'
				)
			)
				.map((a) => a.getAttribute('data-user-id'))
				.sort()
		).toEqual([OWN, LISA].sort());
	});
});
