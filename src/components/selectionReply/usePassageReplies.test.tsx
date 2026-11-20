// @vitest-environment oriso-jsdom
import { describe, expect, it, vi } from 'vite-plus/test';
import { act, renderHook } from '@testing-library/react';

import { usePassageReplies } from './usePassageReplies';
import type { SelectionAnswer } from './SelectionReplyLayer';

const answer = (
	text: string,
	voice: SelectionAnswer['voice'] = null
): SelectionAnswer => ({
	passage: {
		eventId: '$m1',
		author: 'Lena',
		text: `passage ${text}`,
		start: 3
	},
	text,
	voice
});

const setup = (send = vi.fn().mockResolvedValue(undefined)) => {
	const onSendFailed = vi.fn();
	const releaseVoice = vi.fn();
	const hook = renderHook(
		({ conversationKey }) =>
			usePassageReplies({
				send,
				onSendFailed,
				releaseVoice,
				conversationKey
			}),
		{ initialProps: { conversationKey: 'room-a' } }
	);
	return { ...hook, send, onSendFailed, releaseVoice };
};

describe('usePassageReplies', () => {
	it('collects answers and sends them with the typed text as one message', async () => {
		const { result, send } = setup();
		act(() => result.current.collect(answer('eins')));
		act(() => result.current.collect(answer('zwei')));
		expect(result.current.pending).toHaveLength(2);

		await act(() => result.current.sendCollected('Bis morgen.'));

		expect(send).toHaveBeenCalledOnce();
		expect(send).toHaveBeenCalledWith(
			[
				expect.objectContaining({
					eventId: '$m1',
					excerpt: 'passage eins',
					start: 3,
					text: 'eins'
				}),
				expect.objectContaining({ text: 'zwei' })
			],
			'Bis morgen.'
		);
		expect(result.current.pending).toHaveLength(0);
	});

	it('sends straight from the answer field, taking the collected ones along', async () => {
		const { result, send } = setup();
		act(() => result.current.collect(answer('eins')));

		await act(() => result.current.sendNow(answer('sofort')));

		expect(send.mock.calls[0][0].map((row: any) => row.text)).toEqual([
			'eins',
			'sofort'
		]);
	});

	it('keeps every answer and the typed text when the send fails', async () => {
		const send = vi
			.fn()
			.mockRejectedValueOnce(new Error('offline'))
			.mockResolvedValueOnce(undefined);
		const { result, onSendFailed } = setup(send);
		act(() => result.current.collect(answer('eins')));

		await act(() => result.current.sendNow(answer('sofort')));

		expect(onSendFailed).toHaveBeenCalledOnce();
		expect(result.current.pending.map((row) => row.replyText)).toEqual([
			'eins',
			'sofort'
		]);

		await act(() => result.current.sendCollected('Bis morgen.'));
		expect(send).toHaveBeenLastCalledWith(expect.any(Array), 'Bis morgen.');
	});

	it('carries the typed text of a failed send into the next one', async () => {
		const send = vi
			.fn()
			.mockRejectedValueOnce(new Error('offline'))
			.mockResolvedValueOnce(undefined);
		const { result } = setup(send);
		act(() => result.current.collect(answer('eins')));

		await act(() => result.current.sendCollected('Zuerst.'));
		await act(() => result.current.sendCollected('Danach.'));

		expect(send).toHaveBeenLastCalledWith(
			expect.any(Array),
			'Zuerst.\n\nDanach.'
		);
	});

	it('releases a clip once it was sent or its answer removed', async () => {
		const { result, releaseVoice } = setup();
		act(() =>
			result.current.collect(
				answer('', { src: 'blob:kept', durationSec: 4 })
			)
		);
		act(() =>
			result.current.collect(
				answer('', { src: 'blob:removed', durationSec: 2 })
			)
		);
		act(() => result.current.remove(result.current.pending[1].id));
		expect(releaseVoice).toHaveBeenCalledWith('blob:removed');

		await act(() => result.current.sendCollected(''));
		expect(releaseVoice).toHaveBeenCalledWith('blob:kept');
	});

	it('drops collected answers when another conversation opens', () => {
		const { result, rerender, send } = setup();
		act(() => result.current.collect(answer('eins')));

		rerender({ conversationKey: 'room-b' });

		expect(result.current.pending).toHaveLength(0);
		expect(send).not.toHaveBeenCalled();
	});
});
