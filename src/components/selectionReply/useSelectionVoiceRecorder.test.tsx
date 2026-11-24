// @vitest-environment oriso-jsdom
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import { act, renderHook } from '@testing-library/react';

import { useSelectionVoiceRecorder } from './useSelectionVoiceRecorder';

class FakeMediaRecorder {
	static isTypeSupported = (type: string) => type === 'audio/webm';
	mimeType: string;
	state: 'inactive' | 'recording' = 'inactive';
	ondataavailable: ((event: { data: Blob }) => void) | null = null;
	onstop: (() => void) | null = null;
	constructor(_stream: unknown, options?: { mimeType?: string }) {
		this.mimeType = options?.mimeType || '';
	}
	start() {
		this.state = 'recording';
	}
	stop() {
		this.state = 'inactive';
		this.ondataavailable?.({
			data: new Blob(['sound'], { type: this.mimeType })
		});
		this.onstop?.();
	}
}

const stopTrack = vi.fn();

beforeEach(() => {
	vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
	Object.defineProperty(navigator, 'mediaDevices', {
		configurable: true,
		value: {
			getUserMedia: vi.fn().mockResolvedValue({
				getTracks: () => [{ stop: stopTrack }]
			})
		}
	});
	URL.createObjectURL = vi.fn(() => 'blob:take');
	URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
	vi.unstubAllGlobals();
	stopTrack.mockReset();
});

describe('useSelectionVoiceRecorder', () => {
	it('records a take named like the composer voice note and keeps its file', async () => {
		const { result } = renderHook(() => useSelectionVoiceRecorder());
		expect(result.current.recorder).toBeDefined();

		await act(() => result.current.recorder!.start());
		let take: { src: string; durationSec: number } | undefined;
		await act(async () => {
			take = await result.current.recorder!.stop();
		});

		expect(take).toEqual({ src: 'blob:take', durationSec: 1 });
		const kept = result.current.takeFor('blob:take');
		expect(kept?.file.type).toBe('audio/webm');
		expect(kept?.file.name).toMatch(/^voice-message-\d+-s1-ms\d+\.webm$/);
		expect(stopTrack).toHaveBeenCalled();
	});

	it('releases a take and every take on unmount', async () => {
		const { result, unmount } = renderHook(() =>
			useSelectionVoiceRecorder()
		);
		await act(() => result.current.recorder!.start());
		await act(async () => {
			await result.current.recorder!.stop();
		});

		act(() => result.current.release('blob:take'));
		expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:take');
		expect(result.current.takeFor('blob:take')).toBeUndefined();

		unmount();
	});

	it('hands back the live microphone for the level dots', async () => {
		const { result } = renderHook(() => useSelectionVoiceRecorder());
		let stream: unknown;
		await act(async () => {
			stream = await result.current.recorder!.start();
		});
		expect(stream).toEqual(
			expect.objectContaining({ getTracks: expect.any(Function) })
		);
	});

	it('closes a microphone that opens after the reply was cancelled', async () => {
		let grant: (stream: unknown) => void = () => undefined;
		(
			navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>
		).mockReturnValueOnce(
			new Promise((resolve) => {
				grant = resolve;
			})
		);
		const { result, unmount } = renderHook(() =>
			useSelectionVoiceRecorder()
		);
		const starting = result.current.recorder!.start();
		unmount();
		grant({ getTracks: () => [{ stop: stopTrack }] });

		await expect(starting).rejects.toThrow('Recording cancelled');
		expect(stopTrack).toHaveBeenCalledTimes(1);
	});

	it('a take cancelled while it stops does not block the next one (#2505)', async () => {
		// The browser holds the last event back: stop() stays pending.
		const realStop = FakeMediaRecorder.prototype.stop;
		FakeMediaRecorder.prototype.stop = function (this: FakeMediaRecorder) {
			this.state = 'inactive';
		};
		const { result } = renderHook(() => useSelectionVoiceRecorder());
		await act(() => result.current.recorder!.start());
		const first = result.current.recorder!.stop();
		act(() => result.current.recorder!.cancel());
		await expect(first).rejects.toThrow('Recording cancelled');

		FakeMediaRecorder.prototype.stop = realStop;
		await act(() => result.current.recorder!.start());
		let take: { src: string; durationSec: number } | undefined;
		await act(async () => {
			take = await result.current.recorder!.stop();
		});
		expect(take).toEqual({ src: 'blob:take', durationSec: 1 });
	});

	it('offers no microphone where the browser cannot record', () => {
		vi.stubGlobal('MediaRecorder', undefined);
		const { result } = renderHook(() => useSelectionVoiceRecorder());
		expect(result.current.recorder).toBeUndefined();
	});
});
