export type VerificationFailureKind =
	| 'console-error'
	| 'uncaught-error'
	| 'unhandled-rejection'
	| 'unexpected-request'
	| 'fallback';

export interface ExpectedVerificationFailure {
	kind: VerificationFailureKind;
	message: string;
	count: number;
}

// Expectations are local to one story and exact. A newly added error, or an
// expected failure that stopped happening, must both make the verification red.
export const createVerificationRecorder = (
	expected: ExpectedVerificationFailure[] = []
) => {
	const failures: Array<{ kind: VerificationFailureKind; message: string }> =
		[];
	return {
		record(kind: VerificationFailureKind, message: string) {
			failures.push({ kind, message });
		},
		assertComplete() {
			const unexpected = failures.filter(
				(failure) =>
					!expected.some(
						(item) =>
							item.kind === failure.kind &&
							item.message === failure.message
					)
			);
			const mismatches = expected.flatMap((item) => {
				const received = failures.filter(
					(failure) =>
						item.kind === failure.kind &&
						item.message === failure.message
				).length;
				return received === item.count
					? []
					: [
							`${item.kind}: ${item.message}: expected ${item.count}, received ${received}`
						];
			});
			const messages = [
				...unexpected.map(
					(failure) => `${failure.kind}: ${failure.message}`
				),
				...mismatches
			];
			if (messages.length)
				throw new Error(
					`Story verification failed:\n${messages.join('\n')}`
				);
		}
	};
};

export const isProductRequest = (url: string) =>
	/\/(service|api|auth)(\/|$)/.test(new URL(url).pathname);
