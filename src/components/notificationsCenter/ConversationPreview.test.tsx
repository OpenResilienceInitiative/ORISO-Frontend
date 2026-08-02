// @vitest-environment jsdom
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const transport = vi.hoisted(() => ({
	getMatrixRoom: vi.fn(),
	getMatrixRoomMessages: vi.fn(),
	onMatrixTimeline: vi.fn(() => () => undefined)
}));

// The real chatTransportService imports matrix-js-sdk (heavyweight, hangs the
// jsdom worker) — the preview only needs these three calls.
vi.mock('../../services/chatTransportService', () => ({
	chatTransportService: transport
}));

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (_key: string, defaultValue?: string) => defaultValue ?? _key,
		i18n: { language: 'de' }
	})
}));

import { ConversationPreview } from './ConversationPreview';
import { setMatrixClientServiceRef } from '../../services/matrixClientRegistry';

const matrixEvent = (overrides: {
	id: string;
	sender: string;
	body?: string;
	content?: Record<string, unknown>;
	ts?: number;
}) => ({
	getType: () => 'm.room.message',
	getClearContent: () =>
		overrides.content ?? {
			msgtype: 'm.text',
			body: overrides.body ?? ''
		},
	getContent: () =>
		overrides.content ?? {
			msgtype: 'm.text',
			body: overrides.body ?? ''
		},
	getSender: () => overrides.sender,
	getTs: () => overrides.ts ?? 1754040000000,
	getId: () => overrides.id
});

const room = {
	roomId: '!room:matrix.example',
	getMember: (senderId: string) => ({
		name: senderId.split(':')[0].substring(1)
	})
};

const arrange = (events: any[], roomExists = true) => {
	transport.getMatrixRoom.mockReturnValue(roomExists ? room : null);
	transport.getMatrixRoomMessages.mockReturnValue(events);
	setMatrixClientServiceRef({
		getClient: () => ({ getUserId: () => '@consultant:matrix.example' })
	} as any);
};

afterEach(() => {
	vi.clearAllMocks();
	setMatrixClientServiceRef(null);
});

describe('ConversationPreview (#847)', () => {
	it('renders the room timeline from the local Matrix client', () => {
		arrange([
			matrixEvent({
				id: '$1',
				sender: '@lisa:matrix.example',
				body: 'Hallo, ich brauche Hilfe.'
			}),
			matrixEvent({
				id: '$2',
				sender: '@consultant:matrix.example',
				body: 'Gern — erzählen Sie.'
			})
		]);

		render(<ConversationPreview roomId="!room:matrix.example" />);

		expect(screen.getByText('Hallo, ich brauche Hilfe.')).toBeTruthy();
		expect(screen.getByText('Gern — erzählen Sie.')).toBeTruthy();
		expect(screen.getByText('lisa')).toBeTruthy();
	});

	it('marks own messages so the bubble aligns right', () => {
		arrange([
			matrixEvent({
				id: '$2',
				sender: '@consultant:matrix.example',
				body: 'Meine Antwort'
			})
		]);

		const { container } = render(
			<ConversationPreview roomId="!room:matrix.example" />
		);

		expect(
			container.querySelector('.conversationPreview__message--own')
		).toBeTruthy();
	});

	it('strips markup instead of injecting formatted_body HTML', () => {
		arrange([
			matrixEvent({
				id: '$3',
				sender: '@lisa:matrix.example',
				content: {
					msgtype: 'm.text',
					body: 'bold',
					formatted_body: '<b>bold</b><img src=x onerror=alert(1)>'
				}
			})
		]);

		const { container } = render(
			<ConversationPreview roomId="!room:matrix.example" />
		);

		expect(container.querySelector('img')).toBeNull();
		expect(container.querySelector('b')).toBeNull();
		expect(screen.getByText('bold')).toBeTruthy();
	});

	it('shows the unavailable notice when the room is not in the client store', () => {
		arrange([], false);

		render(<ConversationPreview roomId="!missing:matrix.example" />);

		expect(screen.getByText(/preview is not available yet/)).toBeTruthy();
	});

	it('shows the empty state for a room without messages', () => {
		arrange([]);

		render(<ConversationPreview roomId="!room:matrix.example" />);

		expect(
			screen.getByText(/No messages in this conversation/)
		).toBeTruthy();
	});

	it('subscribes to the room timeline but never issues a network call', () => {
		// #847 core guarantee: the old iframe booted a session view that
		// PATCHed /event-notifications/active-view and made the backend drop
		// message.new for the previewed room. The preview reads the synced
		// client store only.
		const fetchSpy = vi.spyOn(global, 'fetch' as any);
		arrange([
			matrixEvent({
				id: '$1',
				sender: '@lisa:matrix.example',
				body: 'Hi'
			})
		]);

		render(<ConversationPreview roomId="!room:matrix.example" />);

		expect(transport.onMatrixTimeline).toHaveBeenCalledWith(
			'!room:matrix.example',
			expect.any(Function)
		);
		expect(fetchSpy).not.toHaveBeenCalled();
		fetchSpy.mockRestore();
	});
});
