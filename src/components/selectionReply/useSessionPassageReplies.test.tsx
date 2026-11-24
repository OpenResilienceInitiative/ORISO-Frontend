// @vitest-environment oriso-jsdom
import { describe, expect, it, vi } from 'vite-plus/test';
import { act, renderHook } from '@testing-library/react';

import { useSessionPassageReplies } from './useSessionPassageReplies';
import type { SelectionAnswer } from './SelectionReplyLayer';

const { sendPassageReplies } = vi.hoisted(() => ({
	sendPassageReplies: vi.fn().mockResolvedValue(undefined)
}));
vi.mock('../../services/chatTransportService', () => ({
	chatTransportService: {
		sendPassageReplies: (...args: unknown[]) => sendPassageReplies(...args)
	}
}));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

const voiceAnswer: SelectionAnswer = {
	passage: { eventId: '$m1', author: 'Lena', text: 'passage', start: 0 },
	text: '',
	voice: { src: 'blob:main-take', durationSec: 4 }
};

describe('useSessionPassageReplies (FE#2494 *7)', () => {
	it('sends a voice answer to the side room from the shared main recorder', async () => {
		const file = new Blob(['x']);
		const sharedVoice = {
			recorder: {
				start: vi.fn(),
				stop: vi.fn(),
				cancel: vi.fn()
			},
			takeFor: vi.fn((src: string) =>
				src === 'blob:main-take' ? { file, durationSec: 4 } : undefined
			),
			release: vi.fn()
		};
		const { result } = renderHook(() =>
			useSessionPassageReplies({
				matrixRoomId: '!supervision:oriso',
				canReply: true,
				sharedVoice: sharedVoice as never
			})
		);

		expect(result.current.recorder).toBe(sharedVoice.recorder);
		await act(() => result.current.sendNow(voiceAnswer));

		expect(sendPassageReplies).toHaveBeenCalledWith(
			expect.objectContaining({
				matrixRoomId: '!supervision:oriso',
				replies: [
					expect.objectContaining({
						voice: { file, durationMs: 4000 }
					})
				]
			})
		);
	});

	it('offers nothing without a room', () => {
		const { result } = renderHook(() =>
			useSessionPassageReplies({ matrixRoomId: null, canReply: true })
		);
		expect(result.current.enabled).toBe(false);
	});
});
