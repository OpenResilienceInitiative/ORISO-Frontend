// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	CHUNK_RELOAD_AT_KEY,
	CHUNK_RELOAD_GUARD_MS,
	RELOAD_FALLBACK_MS,
	isChunkLoadError
} from './chunkLoadRecovery';

const mockAdd = vi.fn();
vi.mock('@opentelemetry/api', () => ({
	metrics: { getMeter: () => ({ createCounter: () => ({ add: mockAdd }) }) }
}));

// Exactly what webpack's JSONP runtime throws on dev.example.org when a chunk
// hash of the previous build 404s (captured 2026-09-16).
const webpackChunkError = () => {
	const error = new Error(
		'Loading chunk 785 failed.\n(error: https://dev.example.org/static/js/785.91cfda41.chunk.js)'
	);
	error.name = 'ChunkLoadError';
	return error;
};

describe('isChunkLoadError', () => {
	it('recognises the webpack ChunkLoadError by name', () => {
		expect(isChunkLoadError(webpackChunkError())).toBe(true);
	});

	it.each([
		'Loading chunk 785 failed.',
		'Loading CSS chunk 265 failed.\n(https://dev.example.org/static/css/265.23045830.chunk.css)',
		'Failed to fetch dynamically imported module: /static/js/1.js',
		'Importing a module script failed.'
	])('recognises the message %s', (message) => {
		expect(isChunkLoadError(new Error(message))).toBe(true);
	});

	it('does not mistake a genuine error inside a module for a stale build', () => {
		expect(
			isChunkLoadError(
				new TypeError(
					"Cannot read properties of undefined (reading 'map')"
				)
			)
		).toBe(false);
	});

	it('tolerates nullish errors', () => {
		expect(isChunkLoadError(undefined)).toBe(false);
		expect(isChunkLoadError(null)).toBe(false);
	});
});

describe('stale build recovery', () => {
	let reload: ReturnType<typeof vi.fn>;
	// The pending-reload flag is module state, so every test gets a fresh module.
	let recovery: typeof import('./chunkLoadRecovery');
	const originalLocation = window.location;

	beforeEach(async () => {
		vi.resetModules();
		recovery = await import('./chunkLoadRecovery');
		window.sessionStorage.clear();
		mockAdd.mockClear();
		reload = vi.fn();
		Object.defineProperty(window, 'location', {
			configurable: true,
			value: { ...originalLocation, reload }
		});
	});

	afterEach(() => {
		Object.defineProperty(window, 'location', {
			configurable: true,
			value: originalLocation
		});
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	describe('reloadOnceForNewBuild', () => {
		it('reloads and remembers when it did', () => {
			vi.spyOn(Date, 'now').mockReturnValue(1_000_000);

			expect(recovery.reloadOnceForNewBuild()).toBe(true);
			expect(reload).toHaveBeenCalledTimes(1);
			expect(window.sessionStorage.getItem(CHUNK_RELOAD_AT_KEY)).toBe(
				'1000000'
			);
			expect(mockAdd).toHaveBeenCalledWith(1, { outcome: 'reload' });
		});

		it('refuses a second reload inside the guard window, so a broken build cannot loop', () => {
			vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
			window.sessionStorage.setItem(
				CHUNK_RELOAD_AT_KEY,
				String(1_000_000 - CHUNK_RELOAD_GUARD_MS + 1)
			);

			expect(recovery.reloadOnceForNewBuild()).toBe(false);
			expect(reload).not.toHaveBeenCalled();
			expect(mockAdd).not.toHaveBeenCalled();
		});

		it('reloads again once the guard window has passed — the next deploy is a new event', () => {
			vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
			window.sessionStorage.setItem(
				CHUNK_RELOAD_AT_KEY,
				String(1_000_000 - CHUNK_RELOAD_GUARD_MS - 1)
			);

			expect(recovery.reloadOnceForNewBuild()).toBe(true);
			expect(reload).toHaveBeenCalledTimes(1);
		});

		it('treats a second failure during the same reload as recovery in progress', () => {
			expect(recovery.reloadOnceForNewBuild()).toBe(true);
			expect(recovery.reloadOnceForNewBuild()).toBe(true);
			expect(reload).toHaveBeenCalledTimes(1);
		});

		it('gives up once a reload the browser swallowed has had its time', () => {
			vi.useFakeTimers();
			expect(recovery.reloadOnceForNewBuild()).toBe(true);

			vi.advanceTimersByTime(RELOAD_FALLBACK_MS);

			expect(recovery.reloadOnceForNewBuild()).toBe(false);
			expect(reload).toHaveBeenCalledTimes(1);
		});

		it('does not reload without sessionStorage, because nothing could stop a loop', () => {
			vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
				throw new Error('SecurityError');
			});

			expect(recovery.reloadOnceForNewBuild()).toBe(false);
			expect(reload).not.toHaveBeenCalled();
		});
	});

	describe('loadChunk', () => {
		it('returns the module when the import succeeds', async () => {
			const factory = vi.fn().mockResolvedValue({ Login: 'component' });

			await expect(recovery.loadChunk(factory)).resolves.toEqual({
				Login: 'component'
			});
			expect(factory).toHaveBeenCalledTimes(1);
			expect(reload).not.toHaveBeenCalled();
		});

		it('retries once, so a request that hit a pod mid-rollout does not end on error.500.html', async () => {
			vi.useFakeTimers();
			const factory = vi
				.fn()
				.mockRejectedValueOnce(webpackChunkError())
				.mockResolvedValueOnce({ Login: 'component' });

			const result = recovery.loadChunk(factory);
			await vi.runAllTimersAsync();

			await expect(result).resolves.toEqual({ Login: 'component' });
			expect(factory).toHaveBeenCalledTimes(2);
			expect(reload).not.toHaveBeenCalled();
			expect(mockAdd).toHaveBeenCalledWith(1, { outcome: 'retry' });
		});

		it('reloads once when the chunk is gone for good — the tab still runs the previous build', async () => {
			vi.useFakeTimers();
			const factory = vi.fn().mockRejectedValue(webpackChunkError());

			let settled = false;
			recovery.loadChunk(factory).then(
				() => (settled = true),
				() => (settled = true)
			);
			await vi.advanceTimersByTimeAsync(1_000);

			expect(factory).toHaveBeenCalledTimes(2);
			expect(reload).toHaveBeenCalledTimes(1);
			// Settling would flash the error page in the moment before the
			// reload lands.
			expect(settled).toBe(false);
		});

		it('lets two chunks that fail together share one reload, and neither reaches the error page', async () => {
			vi.useFakeTimers();
			const settled: string[] = [];
			recovery
				.loadChunk(vi.fn().mockRejectedValue(webpackChunkError()))
				.then(
					() => settled.push('route'),
					() => settled.push('route')
				);
			recovery
				.loadChunk(vi.fn().mockRejectedValue(webpackChunkError()))
				.then(
					() => settled.push('composer'),
					() => settled.push('composer')
				);

			await vi.advanceTimersByTimeAsync(1_000);

			expect(reload).toHaveBeenCalledTimes(1);
			expect(settled).toEqual([]);
		});

		it('gives the error to the ErrorBoundary when a reload already happened moments ago', async () => {
			vi.useFakeTimers();
			window.sessionStorage.setItem(
				CHUNK_RELOAD_AT_KEY,
				String(Date.now())
			);
			const error = webpackChunkError();
			const factory = vi.fn().mockRejectedValue(error);

			const result = recovery.loadChunk(factory);
			result.catch(() => undefined);
			await vi.runAllTimersAsync();

			await expect(result).rejects.toBe(error);
			expect(reload).not.toHaveBeenCalled();
		});

		it('rejects after a while when the browser silently ignored the reload', async () => {
			vi.useFakeTimers();
			const error = webpackChunkError();
			const factory = vi.fn().mockRejectedValue(error);

			const result = recovery.loadChunk(factory);
			result.catch(() => undefined);
			await vi.advanceTimersByTimeAsync(1_000);
			expect(reload).toHaveBeenCalledTimes(1);

			await vi.advanceTimersByTimeAsync(RELOAD_FALLBACK_MS);
			await expect(result).rejects.toBe(error);
		});

		it('never reloads for a genuine error inside the module', async () => {
			vi.useFakeTimers();
			const error = new TypeError('x is not a function');
			const factory = vi.fn().mockRejectedValue(error);

			const result = recovery.loadChunk(factory);
			result.catch(() => undefined);
			await vi.runAllTimersAsync();

			await expect(result).rejects.toBe(error);
			expect(factory).toHaveBeenCalledTimes(1);
			expect(reload).not.toHaveBeenCalled();
		});
	});
});
