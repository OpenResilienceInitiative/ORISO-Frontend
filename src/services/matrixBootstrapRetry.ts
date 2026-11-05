export class MatrixBootstrapThrottledError extends Error {
	constructor(readonly retryAfterMs: number) {
		super('Matrix device login is temporarily throttled');
	}
}

const MAX_RETRIES = 3;

const waitForRetry = (delayMs: number, signal: AbortSignal) =>
	new Promise<boolean>((resolve) => {
		if (signal.aborted) {
			resolve(false);
			return;
		}
		const cancel = () => {
			clearTimeout(timer);
			resolve(false);
		};
		const timer = setTimeout(() => {
			signal.removeEventListener('abort', cancel);
			resolve(true);
		}, delayMs);
		signal.addEventListener('abort', cancel, { once: true });
	});

export const retryMatrixBootstrap = async (
	connect: () => Promise<void>,
	initialError: MatrixBootstrapThrottledError,
	signal: AbortSignal
): Promise<void> => {
	let error = initialError;
	for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
		if (
			!(await waitForRetry(error.retryAfterMs, signal)) ||
			signal.aborted
		) {
			return;
		}
		try {
			await connect();
			return;
		} catch (failure) {
			if (!(failure instanceof MatrixBootstrapThrottledError)) {
				throw failure;
			}
			error = failure;
		}
	}
	throw error;
};
