import { afterEach, describe, expect, it, vi } from 'vitest';
import { withTimeout } from './promiseTimeout';

afterEach(() => vi.useRealTimers());

describe('withTimeout', () => {
	it('returns a value that settles before the deadline', async () => {
		await expect(
			withTimeout(Promise.resolve('ready'), 100, 'too slow')
		).resolves.toBe('ready');
	});

	it('rejects a pending operation at the deadline', async () => {
		vi.useFakeTimers();
		const result = expect(
			withTimeout(new Promise(() => undefined), 100, 'Matrix timed out')
		).rejects.toThrow('Matrix timed out');
		await vi.advanceTimersByTimeAsync(100);
		await result;
	});
});
