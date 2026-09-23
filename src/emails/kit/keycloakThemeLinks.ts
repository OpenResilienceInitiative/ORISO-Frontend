/* eslint-disable no-template-curly-in-string --
 * `${env.…}` here is literal theme.properties syntax for Keycloak, not a
 * JavaScript template literal.
 */

/**
 * The container env var the Keycloak image reads the app origin from. Helm
 * renders it; the Keycloak SPI refuses to start without a valid value.
 */
export const APP_BASE_URL_ENV = 'ORISO_APP_BASE_URL';

/** Link theme properties and the app path each one points at. */
export const KEYCLOAK_LINK_PATHS: Record<string, string> = {
	orisoPrivacyUrl: '/datenschutz',
	orisoImprintUrl: '/impressum',
	orisoSettingsUrl: '/profile/settings',
	orisoUnsubscribeUrl: '/profile/settings/notifications',
	orisoLoginUrl: '/login',
	orisoAppUrl: ''
};

/**
 * theme.properties values: Keycloak substitutes `${env.X}` from the container
 * environment when it loads the theme (DefaultThemeManager, Keycloak 26).
 */
export const keycloakLinkProperties = (): Record<string, string> =>
	Object.fromEntries(
		Object.entries(KEYCLOAK_LINK_PATHS).map(([key, linkPath]) => [
			key,
			`\${env.${APP_BASE_URL_ENV}}${linkPath}`
		])
	);

const PRODUCTION_HOST = /oriso\.org/;
// A scheme followed by a host, wherever it stands: a default, a property
// value, a quoted attribute. A bare `"https://"` (a prefix check) has no host.
const LITERAL_URL = /https?:\/\/[\w-]/i;

/** Every line that names the production host or any literal URL. */
export const findHardcodedUrls = (
	files: { name: string; content: string }[]
): string[] =>
	files.flatMap(({ name, content }) =>
		content
			.split('\n')
			.map((line, index) => ({ line, index }))
			.filter(
				({ line }) =>
					PRODUCTION_HOST.test(line) || LITERAL_URL.test(line)
			)
			.map(({ index }) => `${name}:${index + 1}`)
	);
