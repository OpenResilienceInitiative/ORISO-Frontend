// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	shouldMockStorybookRealtimeUrl,
	StorybookWebSocketMock
} from '../.storybook/storybookRealtimeMocks';

afterEach(() => {
	vi.useRealTimers();
});

describe('Storybook realtime mocks', () => {
	it('preserves first-party realtime widget lifecycles without protocol replies', () => {
		vi.useFakeTimers();

		expect(
			shouldMockStorybookRealtimeUrl(
				'wss://livekit.storybook.test/rtc',
				'https://storybook.local/iframe.html'
			)
		).toBe(true);

		const socket = new StorybookWebSocketMock(
			'wss://livekit.storybook.test/rtc'
		);
		const onOpen = vi.fn();
		const openListener = vi.fn();
		const onMessage = vi.fn();
		const onClose = vi.fn();
		const closeListener = vi.fn();
		socket.onopen = onOpen;
		socket.onmessage = onMessage;
		socket.onclose = onClose;
		socket.addEventListener('open', openListener);
		socket.addEventListener('close', closeListener);

		expect(socket.readyState).toBe(StorybookWebSocketMock.CONNECTING);
		vi.runAllTimers();
		expect(socket.readyState).toBe(StorybookWebSocketMock.OPEN);
		expect(onOpen).toHaveBeenCalledOnce();
		expect(openListener).toHaveBeenCalledOnce();

		expect(socket.send('protocol-neutral-payload')).toBeUndefined();
		expect(onMessage).not.toHaveBeenCalled();

		socket.close();
		expect(socket.readyState).toBe(StorybookWebSocketMock.CLOSED);
		expect(onClose).toHaveBeenCalledOnce();
		expect(closeListener).toHaveBeenCalledOnce();
	});
});
