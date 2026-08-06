export const translateWithFallback = (
	translate: (key: string, options?: Record<string, unknown>) => unknown,
	key: string,
	fallback: string,
	options?: Record<string, unknown>
): string => {
	const value = translate(key, options);
	return typeof value !== 'string' || !value || value === key
		? fallback
		: value;
};
