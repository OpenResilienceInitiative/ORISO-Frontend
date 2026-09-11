// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { chatTransportService } from '../services/chatTransportService';
import { useMatrixActivityEvent } from './useMatrixActivityEvent';

vi.mock('../services/chatTransportService', () => ({
	chatTransportService: {
		getMatrixRoom: vi.fn(),
		onMatrixTimelineRaw: vi.fn(),
		markRoomAsRead: vi.fn()
	}
}));

const encryptedEvent = (eventId: string) => {
	let type = 'm.room.encrypted';
	const listeners = new Set<(event: unknown, error?: Error) => void>();
	const event = {
		getId: () => eventId,
		getType: () => type,
		on: vi.fn((_name: string, listener: (event: unknown) => void) =>
			listeners.add(listener)
		),
		off: vi.fn((_name: string, listener: (event: unknown) => void) =>
			listeners.delete(listener)
		),
		decrypt: () => {
			type = 'm.room.message';
			listeners.forEach((listener) => listener(event));
		},
		failDecryption: () => {
			listeners.forEach((listener) =>
				listener(event, new Error('decryption unavailable'))
			);
		}
	};
	return event;
};

describe('useMatrixActivityEvent', () => {
	beforeEach(() => vi.clearAllMocks());

	it('rehydrates the exact cached event after delayed decryption and cleans up', () => {
		const event = encryptedEvent('$target');
		const detachTimeline = vi.fn();
		vi.mocked(chatTransportService.getMatrixRoom).mockReturnValue({
			findEventById: () => event
		} as any);
		vi.mocked(chatTransportService.onMatrixTimelineRaw).mockReturnValue(
			detachTimeline
		);

		const { result, unmount } = renderHook(() =>
			useMatrixActivityEvent('!room:oriso', '$target')
		);

		expect(result.current.status).toBe('pending-decryption');
		expect(event.on).toHaveBeenCalledTimes(1);

		act(() => event.decrypt());

		expect(result.current).toEqual({ status: 'resolved', event });
		expect(chatTransportService.markRoomAsRead).not.toHaveBeenCalled();

		unmount();
		expect(detachTimeline).toHaveBeenCalledTimes(1);
		expect(event.off).toHaveBeenCalledTimes(1);
	});

	it('keeps one pending listener after a failed decryption attempt', () => {
		const event = encryptedEvent('$target');
		vi.mocked(chatTransportService.getMatrixRoom).mockReturnValue({
			findEventById: () => event
		} as any);
		vi.mocked(chatTransportService.onMatrixTimelineRaw).mockReturnValue(
			vi.fn()
		);

		const { result, unmount } = renderHook(() =>
			useMatrixActivityEvent('!room:oriso', '$target')
		);

		act(() => event.failDecryption());

		expect(result.current.status).toBe('pending-decryption');
		expect(event.on).toHaveBeenCalledTimes(1);

		unmount();
		expect(event.off).toHaveBeenCalledTimes(1);
	});

	it('ignores timeline updates for other Matrix event ids', () => {
		const target = {
			getId: () => '$target',
			getType: () => 'm.room.message'
		};
		vi.mocked(chatTransportService.getMatrixRoom).mockReturnValue({
			findEventById: () => target
		} as any);
		let timelineListener: ((event: any) => void) | undefined;
		vi.mocked(chatTransportService.onMatrixTimelineRaw).mockImplementation(
			(_roomId, listener) => {
				timelineListener = listener;
				return vi.fn();
			}
		);
		const { result, unmount } = renderHook(() =>
			useMatrixActivityEvent('!room:oriso', '$target')
		);

		act(() =>
			timelineListener?.({
				getId: () => '$other',
				getType: () => 'm.room.message'
			})
		);

		expect(result.current).toEqual({ status: 'resolved', event: target });
		unmount();
	});

	it('never renders the previous event while switching reference keys', () => {
		const events = {
			$first: {
				getId: () => '$first',
				getType: () => 'm.room.message'
			},
			$second: {
				getId: () => '$second',
				getType: () => 'm.room.message'
			}
		};
		vi.mocked(chatTransportService.getMatrixRoom).mockReturnValue({
			findEventById: (eventId: keyof typeof events) => events[eventId]
		} as any);
		vi.mocked(chatTransportService.onMatrixTimelineRaw).mockReturnValue(
			vi.fn()
		);
		const renderedEventIds: Array<string | undefined> = [];

		const { rerender, unmount } = renderHook(
			({ eventId }) => {
				const resolution = useMatrixActivityEvent(
					'!room:oriso',
					eventId
				);
				renderedEventIds.push(
					resolution.status === 'resolved'
						? resolution.event.getId()
						: undefined
				);
				return resolution;
			},
			{ initialProps: { eventId: '$first' } }
		);
		renderedEventIds.length = 0;

		rerender({ eventId: '$second' });

		expect(renderedEventIds[0]).toBe('$second');
		unmount();
	});
});
