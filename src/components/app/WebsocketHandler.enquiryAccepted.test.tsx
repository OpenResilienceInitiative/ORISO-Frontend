// @vitest-environment oriso-jsdom
/**
 * FE#1435: the bridge flags the enquiry-accepted notice; the handler must
 * pass that flag on so the "Anfragen" badge drops without waiting for a poll.
 */
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { messageEventEmitter } from '../../services/messageEventEmitter';
import { WebsocketHandler } from './WebsocketHandler';

const bridge = vi.hoisted(() => {
	const listeners = new Map<string, Set<(event: any) => void>>();
	return {
		on: (name: string, cb: (event: any) => void) => {
			if (!listeners.has(name)) listeners.set(name, new Set());
			listeners.get(name).add(cb);
		},
		off: (name: string, cb: (event: any) => void) => {
			listeners.get(name)?.delete(cb);
		},
		emit: (name: string, event: any) => {
			listeners.get(name)?.forEach((cb) => cb(event));
		}
	};
});

vi.mock('../../services/matrixLiveEventBridge', () => ({
	matrixLiveEventBridge: bridge
}));
vi.mock('../../services/feedUpdateSignalBridge', () => ({
	bindFeedUpdateSignal: () => () => {}
}));

describe('WebsocketHandler enquiry-accepted signal (FE#1435)', () => {
	afterEach(() => cleanup());

	it('forwards the enquiry-accepted flag with the room metadata', () => {
		const seen = vi.fn();
		messageEventEmitter.on(seen);
		render(<WebsocketHandler />);

		bridge.emit('directMessage', {
			roomId: '!enquiry',
			eventId: '$notice',
			isOwnMessage: false,
			enquiryAccepted: true
		});
		bridge.emit('directMessage', { roomId: '!chat', eventId: '$text' });
		messageEventEmitter.off(seen);

		const forwarded = seen.mock.calls
			.map(([data]) => data)
			.filter((data) => data.roomId);
		expect(forwarded).toEqual([
			expect.objectContaining({
				roomId: '!enquiry',
				enquiryAccepted: true
			}),
			expect.objectContaining({ roomId: '!chat', enquiryAccepted: false })
		]);
	});
});
