/** The shared Keycloak skeleton can only render keys present in every bundle. */
export const assertKeycloakMessageParity = (
	expected: Record<string, string>,
	actual: Record<string, string>,
	locale: string,
	template: string
): void => {
	const expectedKeys = new Set(Object.keys(expected));
	const actualKeys = new Set(Object.keys(actual));
	const missing = [...expectedKeys].filter((key) => !actualKeys.has(key));
	const extra = [...actualKeys].filter((key) => !expectedKeys.has(key));
	if (missing.length || extra.length) {
		throw new Error(
			`Keycloak bundle ${locale}/${template} has different message keys: missing [${missing.join(', ')}], extra [${extra.join(', ')}].`
		);
	}
};
