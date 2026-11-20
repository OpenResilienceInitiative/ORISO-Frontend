/**
 * Why a chosen file did not go out. `tooLarge` and `format` are refused here,
 * before any upload; the others come back from the send.
 */
export type AttachmentFailureReason =
	| 'tooLarge'
	| 'format'
	| 'serverTooLarge'
	| 'network'
	| 'service'
	| 'cancelled'
	| 'other';

/** A second attempt with the same file can work out for these. */
export const canRetryAttachment = (reason: AttachmentFailureReason): boolean =>
	reason !== 'tooLarge' && reason !== 'serverTooLarge' && reason !== 'format';

const isConnectionProblem = (error: {
	message?: unknown;
	name?: unknown;
}): boolean =>
	error.name === 'ConnectionError' ||
	// matrix-js-sdk reports an XHR with status 0 as an AbortError "to mimic the
	// fetch API", so a dropped connection looks like a cancel. Only the abort
	// signal tells the two apart, and that is the `cancelled` argument below.
	error.name === 'AbortError' ||
	error.name === 'TypeError' ||
	// matrix-js-sdk's stall timer, and fetchData's own timeout.
	error.message === 'Timeout' ||
	error.message === 'TIMEOUT';

/**
 * Sorts a failed send into something the person can act on. A homeserver reply
 * carries `httpStatus`, a token failure arrives as MatrixTokenUnavailableError,
 * and a lost connection has neither.
 */
export const classifyAttachmentSendError = (
	error: unknown,
	cancelled: boolean
): AttachmentFailureReason => {
	if (cancelled) {
		return 'cancelled';
	}
	const failure = (error ?? {}) as {
		cause?: { message?: unknown; name?: unknown };
		errcode?: unknown;
		httpStatus?: unknown;
		message?: unknown;
		name?: unknown;
		status?: unknown;
		statusCode?: unknown;
	};
	if (failure.name === 'MatrixTokenUnavailableError') {
		return failure.cause && isConnectionProblem(failure.cause)
			? 'network'
			: 'service';
	}
	const status = Number(
		failure.httpStatus ?? failure.status ?? failure.statusCode
	);
	if (status === 413 || failure.errcode === 'M_TOO_LARGE') {
		return 'serverTooLarge';
	}
	if (status === 415) {
		return 'format';
	}
	if (status === 429 || status >= 500) {
		return 'service';
	}
	if (isConnectionProblem(failure)) {
		return 'network';
	}
	return 'other';
};

export const attachmentFailureStatus = (error: unknown): number | null => {
	const failure = (error ?? {}) as {
		httpStatus?: unknown;
		status?: unknown;
		statusCode?: unknown;
	};
	const status = Number(
		failure.httpStatus ?? failure.status ?? failure.statusCode
	);
	return Number.isFinite(status) ? status : null;
};
