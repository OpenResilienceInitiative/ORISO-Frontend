// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { useTimelineConversation } from './useTimelineConversation';

const mocks = vi.hoisted(() => ({
	useConversationPreview: vi.fn(),
	useSeenWhileReading: vi.fn()
}));
vi.mock('./useConversationPreview', () => ({
	useConversationPreview: mocks.useConversationPreview
}));
vi.mock('./useSeenWhileReading', () => ({
	useSeenWhileReading: mocks.useSeenWhileReading
}));

afterEach(() => vi.clearAllMocks());

const ROOM = '!r:x';
const card = (id: string, overrides: Record<string, unknown> = {}): any => ({
	id,
	eventType: 'message.new',
	createdAt: '2026-10-28T10:00:00Z',
	readAt: null,
	params: { roomRef: ROOM },
	...overrides
});
const access = (contentHidden = false) => ({
	roomId: ROOM,
	threadRootId: null,
	capabilities: { contentHidden }
});

const setup = (event: any, overrides: Record<string, unknown> = {}) => {
	const markRead = vi.fn();
	const feed = [
		card('a'),
		card('b'),
		card('other', { params: { roomRef: '!o:x' } })
	];
	const hook = renderHook(() =>
		useTimelineConversation({
			event,
			feed,
			unreadOnly: false,
			markRead,
			...overrides
		})
	);
	return { ...hook, markRead };
};

describe('useTimelineConversation (#1888: the selected card’s conversation)', () => {
	it('resolves the shown card’s conversation and nothing when hidden', () => {
		mocks.useConversationPreview.mockReturnValue(null);
		setup(null);
		expect(mocks.useConversationPreview).toHaveBeenLastCalledWith(null, {
			visible: false
		});
		const event = card('a');
		setup(event);
		expect(mocks.useConversationPreview).toHaveBeenLastCalledWith(event, {
			visible: true
		});
	});

	it('uses the event’s room until the preview resolved it', () => {
		mocks.useConversationPreview.mockReturnValue(null);
		expect(setup(card('a')).result.current.roomId).toBe(ROOM);
	});

	it('D1: sees new cards while reading, never while content is hidden (#924)', () => {
		mocks.useConversationPreview.mockReturnValue(access());
		setup(card('a'));
		expect(mocks.useSeenWhileReading).toHaveBeenLastCalledWith(
			expect.objectContaining({ roomId: ROOM, enabled: true })
		);
		mocks.useConversationPreview.mockReturnValue(access(true));
		setup(card('a'));
		expect(mocks.useSeenWhileReading).toHaveBeenLastCalledWith(
			expect.objectContaining({ enabled: false })
		);
	});

	it('D2: reading the conversation reads its room’s message cards', () => {
		mocks.useConversationPreview.mockReturnValue(access());
		const { result, markRead } = setup(card('a'));
		result.current.onConversationRead(ROOM);
		expect(markRead.mock.calls.map(([id]) => id).sort()).toEqual([
			'a',
			'b'
		]);
	});

	it('D2 under the unread filter keeps the selected card in the list', () => {
		mocks.useConversationPreview.mockReturnValue(access());
		const { result, markRead } = setup(card('a'), { unreadOnly: true });
		result.current.onConversationRead(ROOM);
		expect(markRead.mock.calls.map(([id]) => id)).toEqual(['b']);
	});
});
