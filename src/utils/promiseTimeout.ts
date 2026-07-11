export const withTimeout = async <Value>(
	promise: Promise<Value>,
	timeoutMs: number,
	message: string
): Promise<Value> => {
	let timeout: ReturnType<typeof setTimeout> | undefined;
	const timeoutPromise = new Promise<never>((_resolve, reject) => {
		timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
	});
	try {
		return await Promise.race([promise, timeoutPromise]);
	} finally {
		if (timeout !== undefined) {
			clearTimeout(timeout);
		}
	}
};
