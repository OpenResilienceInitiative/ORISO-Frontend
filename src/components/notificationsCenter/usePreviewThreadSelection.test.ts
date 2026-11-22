// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vite-plus/test';
import { usePreviewThreadSelection } from './usePreviewThreadSelection';
import { useSeenWhileReading } from './useSeenWhileReading';

const event = (
	id: string,
	room: string,
	time: string,
	thread?: string
): any => ({
	id,
	eventType: thread ? 'thread.reply.new' : 'message.new',
	category: 'message',
	createdAt: time,
	readAt: null,
	params: { roomRef: room },
	...(thread
		? {
				actionPath: `/sessions/user/view/${room}/13?channel=thread:${thread}`
			}
		: {})
});

it('tracks only the visible thread and resets it on room change and hide/reopen', () => {
	const markRead = vi.fn();
	const old = event('old', '!a:x', '2026-10-22T09:00:00Z');
	const { result, rerender } = renderHook(
		({ visible, room, feed }) => {
			const selection = usePreviewThreadSelection(visible, room, null);
			useSeenWhileReading({
				roomId: room,
				threadRootId: selection.openedThreadRootId,
				enabled: visible,
				feed,
				unreadOnly: false,
				markRead
			});
			return selection;
		},
		{ initialProps: { visible: true, room: '!a:x', feed: [old] } }
	);
	act(() => result.current.setOpenedThreadRootId('$root'));
	const main = event('main', '!a:x', '2026-10-22T10:00:00Z');
	const inThread = event('thread', '!a:x', '2026-10-22T10:00:01Z', '$root');
	const other = event('other', '!a:x', '2026-10-22T10:00:02Z', '$other');
	rerender({
		visible: true,
		room: '!a:x',
		feed: [old, main, inThread, other]
	});
	expect(markRead).toHaveBeenCalledWith('thread');
	expect(markRead).not.toHaveBeenCalledWith('main');
	expect(markRead).not.toHaveBeenCalledWith('other');
	rerender({ visible: true, room: '!b:x', feed: [] });
	rerender({
		visible: true,
		room: '!a:x',
		feed: [old, main, inThread, other]
	});
	expect(result.current.openedThreadRootId).toBeNull();
	act(() => result.current.setOpenedThreadRootId('$root'));
	rerender({ visible: false, room: '!a:x', feed: [] });
	rerender({ visible: true, room: '!a:x', feed: [] });
	expect(result.current.openedThreadRootId).toBeNull();
});
