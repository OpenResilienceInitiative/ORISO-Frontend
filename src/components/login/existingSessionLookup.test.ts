import { describe, expect, it, vi } from 'vitest';
import { resolveExistingSession } from './existingSessionLookup';

const deferred = <T>() => {
	let resolve!: (value: T) => void;
	let reject!: (reason: unknown) => void;
	const promise = new Promise<T>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise;
		reject = rejectPromise;
	});
	return { promise, resolve, reject };
};

describe('existing session lookup', () => {
	it('hands a current session to the redirect handler', async () => {
		const onResolved = vi.fn();
		const onFailure = vi.fn();

		await resolveExistingSession({
			load: async () => 'current session',
			isCurrent: () => true,
			onResolved,
			onFailure
		});

		expect(onResolved).toHaveBeenCalledWith('current session');
		expect(onFailure).not.toHaveBeenCalled();
	});

	it('ignores a result after the link changes or sign-in starts', async () => {
		const request = deferred<string>();
		let current = true;
		const onResolved = vi.fn();
		const onFailure = vi.fn();
		const lookup = resolveExistingSession({
			load: () => request.promise,
			isCurrent: () => current,
			onResolved,
			onFailure
		});

		current = false;
		request.resolve('old session');
		await lookup;

		expect(onResolved).not.toHaveBeenCalled();
		expect(onFailure).not.toHaveBeenCalled();
	});

	it('ignores a failed lookup after unmount', async () => {
		const request = deferred<string>();
		let current = true;
		const onFailure = vi.fn();
		const lookup = resolveExistingSession({
			load: () => request.promise,
			isCurrent: () => current,
			onResolved: vi.fn(),
			onFailure
		});

		current = false;
		request.reject(new Error('unavailable'));
		await lookup;

		expect(onFailure).not.toHaveBeenCalled();
	});

	it('reports a current failed lookup without redirecting', async () => {
		const request = deferred<string>();
		const onResolved = vi.fn();
		const onFailure = vi.fn();
		const lookup = resolveExistingSession({
			load: () => request.promise,
			isCurrent: () => true,
			onResolved,
			onFailure
		});

		request.reject(new Error('unavailable'));
		await lookup;

		expect(onResolved).not.toHaveBeenCalled();
		expect(onFailure).toHaveBeenCalledOnce();
	});
});
