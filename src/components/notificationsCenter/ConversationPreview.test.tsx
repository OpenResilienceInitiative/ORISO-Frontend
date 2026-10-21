// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { setMatrixClientServiceRef } from '../../services/matrixClientRegistry';
import { composerHtmlToTransportMarkup } from '../messageSubmitInterface/composerTransportEncoding';

const transport = vi.hoisted(() => ({
	getMatrixRoom: vi.fn(),
	getMatrixRoomMessages: vi.fn(),
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

const arrange = (events: any[], roomExists = true) => {
	transport.getMatrixRoom.mockReturnValue(roomExists ? room : null);
	transport.getMatrixRoomMessages.mockReturnValue(events);
	setMatrixClientServiceRef({ getClient: () => matrixClient } as any);
};

let ConversationPreview: typeof import('./ConversationPreview').ConversationPreview;
let MessageContextShell: typeof import('../message/messageStoryShell').MessageContextShell;

beforeAll(async () => {
	// MessageItemComponent is a big module graph; load it once.
	({ ConversationPreview } = await import('./ConversationPreview'));
	({ MessageContextShell } = await import('../message/messageStoryShell'));
}, 60000);

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
		expect(fetchSpy).not.toHaveBeenCalled();
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
