export const resolveMatrixSessionId = (value: unknown): number | undefined => {
	if (value === null || value === undefined || value === '') {
		return undefined;
	}

	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
};
