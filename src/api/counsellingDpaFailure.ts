/** The authoritative AVV owner distinguishes legal refusal from verification failure. */
export const getCounsellingDpaFailure = (error: unknown) => {
	if (!(error instanceof Response)) return null;
	const reason = error.headers.get('X-Reason');
	if (error.status === 403 && reason === 'DPA_NEW_COUNSELLING_NOT_ALLOWED') {
		return { key: 'counselling.dpa.restricted', retryable: false } as const;
	}
	if (error.status === 502 && reason === 'DPA_POLICY_UNAVAILABLE') {
		return { key: 'counselling.dpa.unavailable', retryable: true } as const;
	}
	return null;
};
