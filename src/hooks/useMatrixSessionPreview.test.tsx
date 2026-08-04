// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { chatTransportService } from '../services/chatTransportService';
import { useMatrixSessionPreview } from './useMatrixSessionPreview';

vi.mock('../services/chatTransportService', () => ({
	chatTransportService: {
		getMatrixRoomMessages: vi.fn(),
		onMatrixTimeline: vi.fn()
	}
}));

describe('useMatrixSessionPreview', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(chatTransportService.getMatrixRoomMessages).mockReturnValue([]);
		vi.mocked(chatTransportService.onMatrixTimeline).mockReturnValue(
			vi.fn()
		);
	});

	it('keeps the timeline subscription stable across unrelated rerenders', () => {
		const { rerender } = renderHook(
			({ roomId, unrelated }) => {
				void unrelated;
				return useMatrixSessionPreview(roomId, true);
			},
			{
				initialProps: { roomId: '!room:example.org', unrelated: 1 }
			}
		);

		rerender({ roomId: '!room:example.org', unrelated: 2 });

		expect(chatTransportService.onMatrixTimeline).toHaveBeenCalledTimes(1);
	});

	it('refreshes from decrypted timeline updates and detaches on disable', () => {
		const detach = vi.fn();
		let timelineListener: (() => void) | undefined;
		vi.mocked(chatTransportService.onMatrixTimeline).mockImplementation(
			(_roomId, listener) => {
				timelineListener = listener;
				return detach;
			}
		);
		vi.mocked(chatTransportService.getMatrixRoomMessages)
			.mockReturnValueOnce([])
			.mockReturnValueOnce([
				{
					getType: () => 'm.room.message',
					getContent: () => ({ body: 'decrypted later' })
				} as never
			]);

		const { result, rerender } = renderHook(
			({ enabled }) =>
				useMatrixSessionPreview('!room:example.org', enabled),
			{ initialProps: { enabled: true } }
		);

		expect(result.current).toBeNull();
		act(() => timelineListener?.());
		expect(result.current).toBe('decrypted later');

		rerender({ enabled: false });
		expect(detach).toHaveBeenCalledTimes(1);
		expect(result.current).toBeNull();
	});
});
