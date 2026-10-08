import { MatrixError } from 'matrix-js-sdk';

/** The authoritative AVV owner distinguishes legal refusal from verification failure. */
export const getCounsellingDpaFailure = (error: unknown) => {
	if (!(error instanceof Response) && !(error instanceof MatrixError)) {
		return null;
	}
	const status = error instanceof Response ? error.status : error.httpStatus;
	const reason =
		error instanceof Response
			? error.headers.get('X-Reason')
			: error.data['org.oriso.reason'];
	if (
		error instanceof MatrixError &&
		!(
			(status === 403 && error.errcode === 'M_FORBIDDEN') ||
			(status === 502 && error.errcode === 'M_UNKNOWN')
		)
	) {
		return null;
	}
	if (status === 403 && reason === 'DPA_NEW_COUNSELLING_NOT_ALLOWED') {
		return { key: 'counselling.dpa.restricted', retryable: false } as const;
	}
	if (status === 502 && reason === 'DPA_POLICY_UNAVAILABLE') {
		return { key: 'counselling.dpa.unavailable', retryable: true } as const;
	}
	return null;
};
