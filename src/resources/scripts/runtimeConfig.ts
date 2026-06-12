/**
 * Centralized access to environment-derived configuration.
 *
 * Values are resolved in this order:
 *   1. `window.__ORISO_RUNTIME_CONFIG__` (injected at container start by
 *      scripts/docker-entrypoint.sh, so a single built image can be pointed at
 *      different environments without rebuilding).
 *   2. Build-time `process.env.*` (Create React App inlines these at build).
 *
 * Each getter accepts multiple key aliases because the deployment and the code
 * historically used different names (e.g. `REACT_APP_ELEMENT_CALL_URL` vs
 * `REACT_APP_ELEMENT_CALL_BASE_URL`).
 */

type RuntimeConfig = Record<string, string | undefined>;

const getRuntimeConfig = (): RuntimeConfig => {
	if (typeof window === 'undefined') {
		return {};
	}
	return ((window as any).__ORISO_RUNTIME_CONFIG__ as RuntimeConfig) || {};
};

/**
 * When the container runtime config is incomplete (e.g. production config.js
 * only has REACT_APP_API_URL), derive sibling service URLs from the app host.
 * `app.oriso.org` -> `api.oriso.org`, `matrix.oriso.org`, `call.oriso.org`, etc.
 */
const inferFromAppHostname = (): RuntimeConfig => {
	if (typeof window === 'undefined') {
		return {};
	}
	const host = window.location.hostname;
	const match = host.match(/^(?:app|www)\.(.+)$/);
	if (!match) {
		return {};
	}
	const base = match[1];
	return {
		REACT_APP_API_URL: `https://api.${base}`,
		REACT_APP_MATRIX_HOMESERVER_URL: `https://matrix.${base}`,
		REACT_APP_MATRIX_URL: `https://matrix.${base}`,
		REACT_APP_ELEMENT_CALL_BASE_URL: `https://call.${base}`,
		REACT_APP_ELEMENT_CALL_URL: `https://call.${base}`,
		REACT_APP_LIVEKIT_WS_URL: `wss://livekit.${base}`,
		REACT_APP_LIVEKIT_URL: `wss://livekit.${base}`
	};
};

const firstNonEmpty = (
	source: RuntimeConfig,
	keys: string[]
): string | undefined => {
	for (const key of keys) {
		const value = source[key];
		if (value !== undefined && String(value).trim() !== '') {
			return String(value).trim();
		}
	}
	return undefined;
};

/**
 * Look up a value by trying runtime config first, then build-time env, across
 * all provided key aliases.
 */
const pickValue = (...keys: string[]): string | undefined => {
	const runtimeValue = firstNonEmpty(getRuntimeConfig(), keys);
	if (runtimeValue) {
		return runtimeValue;
	}
	const buildValue = firstNonEmpty(process.env as RuntimeConfig, keys);
	if (buildValue) {
		return buildValue;
	}
	return firstNonEmpty(inferFromAppHostname(), keys);
};

const stripTrailingSlashes = (value: string): string =>
	value.replace(/\/+$/, '');

/**
 * Ensure an http(s) URL. Bare hostnames are upgraded to https.
 */
const ensureHttps = (value?: string): string => {
	const trimmed = String(value || '').trim();
	if (!trimmed) {
		return '';
	}
	if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
		return trimmed;
	}
	return `https://${trimmed}`;
};

/**
 * Ensure a websocket URL. The LiveKit client needs ws(s)://, but deployments
 * frequently provide http(s):// — convert instead of failing.
 */
const ensureWebsocket = (value?: string): string => {
	const trimmed = String(value || '').trim();
	if (!trimmed) {
		return '';
	}
	if (trimmed.startsWith('wss://') || trimmed.startsWith('ws://')) {
		return trimmed;
	}
	if (trimmed.startsWith('https://')) {
		return `wss://${trimmed.slice('https://'.length)}`;
	}
	if (trimmed.startsWith('http://')) {
		return `ws://${trimmed.slice('http://'.length)}`;
	}
	return `wss://${trimmed}`;
};

/**
 * Matrix homeserver base URL (https). Used for login, client init, Element Call.
 */
export const getMatrixHomeserverUrl = (): string =>
	ensureHttps(
		pickValue(
			'REACT_APP_MATRIX_HOMESERVER_URL',
			'VITE_MATRIX_HOMESERVER_URL',
			'REACT_APP_MATRIX_URL'
		)
	);

/**
 * Element Call deployment origin (https), with any trailing slashes removed.
 */
export const getElementCallBaseUrl = (): string =>
	stripTrailingSlashes(
		ensureHttps(
			pickValue(
				'REACT_APP_ELEMENT_CALL_BASE_URL',
				'REACT_APP_ELEMENT_CALL_URL'
			)
		)
	);

/**
 * LiveKit signalling websocket URL (wss).
 */
export const getLiveKitWsUrl = (): string =>
	ensureWebsocket(
		pickValue('REACT_APP_LIVEKIT_WS_URL', 'REACT_APP_LIVEKIT_URL')
	);
