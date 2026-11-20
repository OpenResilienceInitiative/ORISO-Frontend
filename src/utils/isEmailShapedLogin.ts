// Keycloak usernames can contain the literal email or encode its @ as _at_.
// Detect credential-shaped labels for display filtering.
export const isEmailShapedLogin = (value: string): boolean =>
	/^[^\s@]+(?:@|_at_)[^\s@.]+(?:\.[^\s@.]+)+$/i.test(value.trim());
