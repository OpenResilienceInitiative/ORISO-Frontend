// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vite-plus/test';
import {
	useActivityTimeline,
	UseActivityTimelineInput
} from './useActivityTimeline';

const card = (id: string, overrides: Record<string, unknown> = {}): any => ({
	id,
	eventType: 'message.new',
	createdAt: '2026-10-28T10:00:00Z',
	readAt: null,
	...overrides
});

const NO_ROUTE = { groupId: null, sessionId: null };

const setup = (input: Partial<UseActivityTimelineInput> = {}) => {
	const markRead = vi.fn();
	const initialProps: UseActivityTimelineInput = {
		feed: [card('a'), card('b'), card('c')],
		routeSelection: NO_ROUTE,
		isPhone: false,
		unreadOnly: false,
		markRead,
		...input
	};
	const hook = renderHook((props) => useActivityTimeline(props), {
		initialProps
	});
	return { ...hook, markRead, initialProps };
};

describe('useActivityTimeline (#1888: the Timeline’s selection, in one place)', () => {
	describe('selection', () => {
		it('selects the first card on desktop so the detail pane is never empty', () => {
			const { result } = setup();
			expect(result.current.selectedId).toBe('a');
			expect(result.current.selectedEvent?.id).toBe('a');
		});

		it('selects nothing on a phone, where selecting opens the conversation', () => {
			const { result } = setup({ isPhone: true });
			expect(result.current.selectedId).toBeNull();
			expect(result.current.selectedEvent).toBeNull();
		});

		it('keeps the selection inside the visible feed', () => {
			const { result, rerender, initialProps } = setup();
			act(() => result.current.select('c'));
			expect(result.current.selectedId).toBe('c');
			rerender({ ...initialProps, feed: [card('a'), card('b')] });
			expect(result.current.selectedId).toBe('a');
		});

		it('follows a route-active conversation over the in-page selection', () => {
			const { result } = setup({
				feed: [
					card('a', { sourceSessionId: '1' }),
					card('b', { sourceSessionId: '2' })
				],
				routeSelection: { groupId: null, sessionId: '2' }
			});
			expect(result.current.selectedId).toBe('b');
		});
	});

	describe('#845: displayed means read', () => {
		it('reads the selected card on desktop', () => {
			const { markRead } = setup();
			expect(markRead).toHaveBeenCalledWith('a');
		});

		it('does not read on a phone or under the unread filter', () => {
			expect(setup({ isPhone: true }).markRead).not.toHaveBeenCalled();
			expect(setup({ unreadOnly: true }).markRead).not.toHaveBeenCalled();
		});

		it('does not read a card that is already read', () => {
			const { markRead } = setup({
				feed: [card('a', { readAt: '2026-10-28T10:01:00Z' })]
			});
			expect(markRead).not.toHaveBeenCalled();
		});
	});

	describe('next unread', () => {
		it('is the next unread card after the selected one, wrapping around', () => {
			const { result } = setup({
				feed: [card('a'), card('b', { readAt: 'x' }), card('c')],
				unreadOnly: true
			});
			expect(result.current.nextUnreadId).toBe('c');
		});

		it('anchors on the card that is shown, also when the route chose it', () => {
			const { result } = setup({
				feed: [
					card('a', { sourceSessionId: '1' }),
					card('b', { sourceSessionId: '2' }),
					card('c', { sourceSessionId: '3' })
				],
				routeSelection: { groupId: null, sessionId: '2' },
				unreadOnly: true
			});
			expect(result.current.nextUnreadId).toBe('c');
		});

		it('is null when nothing else is unread', () => {
			const { result } = setup({
				feed: [card('a'), card('b', { readAt: 'x' })],
				unreadOnly: true
			});
			expect(result.current.nextUnreadId).toBeNull();
		});
	});

	describe('embedded conversation', () => {
		it('opens with a message card and stays closed for a system card', () => {
			const { result, rerender, initialProps } = setup({
				feed: [
					card('a'),
					card('s', { eventType: 'request.new', category: 'system' })
				]
			});
			expect(result.current.conversationShown).toBe(true);
			act(() => result.current.select('s'));
			rerender({ ...initialProps });
			expect(result.current.conversationShown).toBe(false);
		});

		it('can be closed and reopened, and reopens with the next card', () => {
			const { result } = setup();
			act(() => result.current.toggleConversation());
			expect(result.current.conversationShown).toBe(false);
			act(() => result.current.toggleConversation());
			expect(result.current.conversationShown).toBe(true);
			act(() => result.current.toggleConversation());
			act(() => result.current.select('b'));
			expect(result.current.conversationShown).toBe(true);
		});

		it('is never shown without a selected card', () => {
			const { result } = setup({ isPhone: true });
			expect(result.current.conversationShown).toBe(false);
		});
	});
});
