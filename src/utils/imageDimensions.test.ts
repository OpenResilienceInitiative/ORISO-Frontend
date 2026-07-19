// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getImageDimensions } from './imageDimensions';

describe('getImageDimensions', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('returns null for non-image files without probing', async () => {
		const file = new File(['x'], 'a.pdf', { type: 'application/pdf' });
		expect(await getImageDimensions(file)).toBeNull();
	});

	it('uses createImageBitmap when available', async () => {
		vi.stubGlobal(
			'createImageBitmap',
			vi
				.fn()
				.mockResolvedValue({ width: 120, height: 72, close: vi.fn() })
		);
		const file = new File(['x'], 'a.png', { type: 'image/png' });
		expect(await getImageDimensions(file)).toEqual({ w: 120, h: 72 });
	});

	it('resolves null when probing fails everywhere', async () => {
		vi.stubGlobal(
			'createImageBitmap',
			vi.fn().mockRejectedValue(new Error('nope'))
		);
		vi.stubGlobal('URL', {
			createObjectURL: vi.fn(() => 'blob:x'),
			revokeObjectURL: vi.fn()
		});
		class FailingImage {
			onload: (() => void) | null = null;

			onerror: (() => void) | null = null;

			set src(_value: string) {
				queueMicrotask(() => this.onerror?.());
			}
		}
		vi.stubGlobal('Image', FailingImage);
		const file = new File(['x'], 'a.png', { type: 'image/png' });
		expect(await getImageDimensions(file)).toBeNull();
	});

	it('times out instead of blocking when image decoding never settles', async () => {
		vi.useFakeTimers();
		vi.stubGlobal(
			'createImageBitmap',
			vi.fn(() => new Promise(() => {}))
		);
		const file = new File(['x'], 'a.png', { type: 'image/png' });

		const dimensions = getImageDimensions(file);
		await vi.advanceTimersByTimeAsync(6000);

		await expect(dimensions).resolves.toBeNull();
		vi.useRealTimers();
	});
});
