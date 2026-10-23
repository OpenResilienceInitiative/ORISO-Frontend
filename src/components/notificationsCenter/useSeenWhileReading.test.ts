// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSeenWhileReading } from './useSeenWhileReading';

const ROOM = '!r1:x';
const event = (id: string, createdAt: string, room = ROOM): any => ({
	id,
	eventType: 'message.new',
	category: 'message',
	createdAt,
	readAt: null,
	params: { roomRef: room }
});

type Props = Parameters<typeof useSeenWhileReading>[0];

const setup = (props: Partial<Props>) => {
	const markRead = vi.fn();
	const initialProps: Props = {
		roomId: ROOM,
		enabled: true,
		feed: [],
		unreadOnly: false,
		markRead,
		...props
	};
	const view = renderHook((current: Props) => useSeenWhileReading(current), {
		initialProps
	});
	return { ...view, markRead, initialProps };
};

afterEach(() => vi.clearAllMocks());

describe('useSeenWhileReading (#1824 D1)', () => {
	it('opening marks nothing, an arrival in the room is marked once', () => {
		const old = event('old', '2026-10-22T09:00:00Z');
		const { rerender, markRead, initialProps } = setup({ feed: [old] });
		expect(markRead).not.toHaveBeenCalled();

		const arrived = event('new', '2026-10-22T10:00:00Z');
		rerender({ ...initialProps, feed: [arrived, old] });
		expect(markRead).toHaveBeenCalledWith('new');
		rerender({ ...initialProps, feed: [{ ...arrived }, old] });
		expect(markRead).toHaveBeenCalledTimes(1);
	});

	it('older events loaded later stay unread', () => {
		const { rerender, markRead, initialProps } = setup({
			feed: [event('a', '2026-10-22T09:00:00Z')]
		});
		rerender({
			...initialProps,
			feed: [
				event('a', '2026-10-22T09:00:00Z'),
				event('older', '2026-10-01T09:00:00Z')
			]
		});
		expect(markRead).not.toHaveBeenCalled();
	});

	it('nothing while disabled or under "unread only"', () => {
		const arrived = event('new', '2026-10-22T10:00:00Z');
		const disabled = setup({ enabled: false });
		disabled.rerender({ ...disabled.initialProps, feed: [arrived] });
		const unreadOnly = setup({ unreadOnly: true });
		unreadOnly.rerender({ ...unreadOnly.initialProps, feed: [arrived] });
		expect(disabled.markRead).not.toHaveBeenCalled();
		expect(unreadOnly.markRead).not.toHaveBeenCalled();
	});

	it('a room switch starts a new baseline', () => {
		const other = event('o1', '2026-10-22T11:00:00Z', '!r2:x');
		const { rerender, markRead, initialProps } = setup({ feed: [other] });
		rerender({ ...initialProps, roomId: '!r2:x', feed: [other] });
		expect(markRead).not.toHaveBeenCalled();
	});
});
