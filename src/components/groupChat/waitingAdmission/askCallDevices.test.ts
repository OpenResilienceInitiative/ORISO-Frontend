import { describe, expect, it, vi } from 'vite-plus/test';
import { askCallDevicesWhileWaiting } from './askCallDevices';

const devices = (result: Promise<MediaStream>) =>
	({ getUserMedia: vi.fn(() => result) }) as unknown as MediaDevices;

describe('askCallDevicesWhileWaiting (#2237)', () => {
	it('asks camera and microphone for a video group and lets go at once', async () => {
		const stop = vi.fn();
		const media = devices(
			Promise.resolve({
				getTracks: () => [{ stop }, { stop }]
			} as unknown as MediaStream)
		);
		askCallDevicesWhileWaiting('VIDEO', media);
		expect(media.getUserMedia).toHaveBeenCalledWith({
			audio: true,
			video: true
		});
		await vi.waitFor(() => expect(stop).toHaveBeenCalledTimes(2));
	});

	it('asks only the microphone for an audio group', () => {
		const media = devices(new Promise(() => undefined));
		askCallDevicesWhileWaiting('AUDIO', media);
		expect(media.getUserMedia).toHaveBeenCalledWith({
			audio: true,
			video: false
		});
	});

	it('asks nothing for a text group and survives a refusal', async () => {
		// Never settles: a text group must not ask, so nothing would catch a rejection.
		const text = devices(new Promise(() => undefined));
		askCallDevicesWhileWaiting('TEXT', text);
		expect(text.getUserMedia).not.toHaveBeenCalled();
		const refused = devices(Promise.reject(new Error('NotAllowedError')));
		expect(() =>
			askCallDevicesWhileWaiting('VIDEO', refused)
		).not.toThrow();
		askCallDevicesWhileWaiting('VIDEO', undefined);
	});
});
