import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import {
	MatrixBootstrapThrottledError,
	retryMatrixBootstrap
} from './matrixBootstrapRetry';

describe('retryMatrixBootstrap', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('waits until each advertised deadline and stops after connecting', async () => {
		const connect = vi
			.fn<() => Promise<void>>()
			.mockRejectedValueOnce(new MatrixBootstrapThrottledError(5_000))
			.mockResolvedValueOnce(undefined);
		const recovery = retryMatrixBootstrap(
			connect,
			new MatrixBootstrapThrottledError(21_000),
			new AbortController().signal
		);

		await vi.advanceTimersByTimeAsync(20_999);
		expect(connect).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);
		expect(connect).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(4_999);
		expect(connect).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(1);
		await recovery;
		await vi.runAllTimersAsync();
		expect(connect).toHaveBeenCalledTimes(2);
	});

	it('cancels a pending retry when the authenticated app leaves', async () => {
		const controller = new AbortController();
		const connect = vi.fn<() => Promise<void>>();
		const recovery = retryMatrixBootstrap(
			connect,
			new MatrixBootstrapThrottledError(21_000),
			controller.signal
		);

		controller.abort();
		await recovery;
		await vi.runAllTimersAsync();
		expect(connect).not.toHaveBeenCalled();
	});

	it('stops on an unrelated bootstrap failure', async () => {
		const failure = new Error('Matrix device changed');
		const connect = vi.fn<() => Promise<void>>().mockRejectedValue(failure);
		const recovery = retryMatrixBootstrap(
			connect,
			new MatrixBootstrapThrottledError(21_000),
			new AbortController().signal
		);
		const rejection = expect(recovery).rejects.toBe(failure);

		await vi.runAllTimersAsync();
		await rejection;
		expect(connect).toHaveBeenCalledOnce();
	});

	it('stops after three denied retries', async () => {
		const throttle = new MatrixBootstrapThrottledError(1_000);
		const connect = vi
			.fn<() => Promise<void>>()
			.mockRejectedValue(throttle);
		const recovery = retryMatrixBootstrap(
			connect,
			throttle,
			new AbortController().signal
		);
		const rejection = expect(recovery).rejects.toBe(throttle);

		await vi.runAllTimersAsync();
		await rejection;
		expect(connect).toHaveBeenCalledTimes(3);
	});
});
