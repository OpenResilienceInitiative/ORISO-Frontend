/**
 * Centralized access to environment-derived configuration.
 *
 * Values are resolved in this order:
 *   1. `window.__ORISO_RUNTIME_CONFIG__` (injected at container start by
 *      scripts/docker-entrypoint.sh, so a single built image can be pointed at
 *      different environments without rebuilding).
 *   2. Build-time `process.env.*` (Create React App inlines these at build).
 *
 * Nothing is inferred from the page hostname. The keys in
 * REQUIRED_RUNTIME_CONFIG must be set explicitly; `initApp` shows a
 * configuration error instead of starting the app when one is missing.
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

const getCypressConfig = (): RuntimeConfig => {
	if (typeof window === 'undefined') {
		return {};
	}

	const cypressEnv = (window as any).Cypress?.env;

	return typeof cypressEnv === 'function'
		? (cypressEnv() as RuntimeConfig) || {}
		: {};
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
	const processEnv =
		typeof process !== 'undefined' ? (process.env as RuntimeConfig) : {};
	const buildValue = firstNonEmpty(processEnv, keys);
	if (buildValue) {
		return buildValue;
	}
	// No further fallback: a service host is never guessed from the page
	// host (ORISO-Helm#368). A missing key surfaces via getRuntimeConfigProblems.
	return firstNonEmpty(getCypressConfig(), keys);
};

const stripTrailingSlashes = (value: string): string =>
	value.replace(/\/+$/, '');

const DEFAULT_OTEL_EXPORT_INTERVAL_MS = 60000;

const parsePositiveInterval = (value?: string): number => {
	const parsed = Number(value);
	return Number.isFinite(parsed) && parsed >= 10000
		? parsed
		: DEFAULT_OTEL_EXPORT_INTERVAL_MS;
};

const validHttpUrl = (value?: string): string => {
	const candidate = String(value || '').trim();
	if (!candidate) {
		return '';
	}

	try {
		const url = new URL(candidate);
		return url.protocol === 'http:' || url.protocol === 'https:'
			? candidate
			: '';
	} catch {
		return '';
	}
};

export interface ObservabilityRuntimeConfig {
	enabled: boolean;
	metricsUrl: string;
	exportIntervalMillis: number;
}

export const getObservabilityConfig = (): ObservabilityRuntimeConfig => ({
	enabled:
		pickValue(
			'REACT_APP_OBSERVABILITY_ENABLED',
			'VITE_OBSERVABILITY_ENABLED'
		)?.toLowerCase() === 'true',
	metricsUrl: validHttpUrl(
		pickValue('REACT_APP_OTEL_METRICS_URL', 'VITE_OTEL_METRICS_URL')
	),
	exportIntervalMillis: parsePositiveInterval(
		pickValue(
			'REACT_APP_OTEL_EXPORT_INTERVAL_MS',
			'VITE_OTEL_EXPORT_INTERVAL_MS'
		)
	)
});

export const getPlatformVersion = (): string =>
	pickValue('REACT_APP_PLATFORM_VERSION', 'VITE_PLATFORM_VERSION') || '';

// Bundle identity bypasses runtime env.js, Cypress and hostname fallbacks.
// An ordinary local build without an injected full commit is unidentified.
export const getBuildCommit = (): string | undefined => {
	const commit = process.env.REACT_APP_BUILD_COMMIT;
	return commit && /^[0-9a-f]{40}$/.test(commit) ? commit : undefined;
};

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
 * ORISO API base URL (https).
 */
export const getRuntimeApiBaseUrl = (): string =>
	ensureHttps(pickValue('REACT_APP_API_URL', 'VITE_API_URL'));

/**
 * Base URL of the matrix-content-scanner media proxy, e.g.
 * `https://<domain>/_matrix/media_proxy/unstable` (ADR-019).
 *
 * Empty means no scanner is deployed in this environment — which is the
 * normal case today. Deliberately not inferred from the app hostname: a
 * guessed scanner URL would send file keys somewhere nobody configured.
 */
export const getMediaScannerUrl = (): string =>
	stripTrailingSlashes(
		pickValue('REACT_APP_MEDIA_SCANNER_URL', 'VITE_MEDIA_SCANNER_URL') || ''
	);

const isLocalServiceOrigin = (value?: string | null): boolean =>
	/^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(
		String(value || '').trim()
	);

/**
 * In local dev, remote service origins must stay same-origin so webpack-dev-server
 * can proxy /service and /auth to REACT_APP_DEV_REMOTE_API_URL. Absolute remote
 * URLs bypass the proxy and trigger browser CORS failures.
 */
const resolveServiceOriginForEnvironment = (origin: string): string => {
	if (!origin) {
		return '';
	}

	const nodeEnv =
		typeof process !== 'undefined' ? process.env.NODE_ENV : undefined;
	if (nodeEnv === 'development' && !isLocalServiceOrigin(origin)) {
		return '';
	}

	return origin;
};

const getServiceOrigin = (key: string, fallbackOrigin: string): string =>
	resolveServiceOriginForEnvironment(
		stripTrailingSlashes(ensureHttps(pickValue(key) || fallbackOrigin))
	);

export const getUserServiceOrigin = (
	fallbackOrigin = getRuntimeApiBaseUrl()
): string => getServiceOrigin('REACT_APP_USER_SERVICE_ORIGIN', fallbackOrigin);

export const getTenantServiceOrigin = (
	fallbackOrigin = getRuntimeApiBaseUrl()
): string =>
	getServiceOrigin('REACT_APP_TENANT_SERVICE_ORIGIN', fallbackOrigin);

export const getAgencyServiceOrigin = (
	fallbackOrigin = getRuntimeApiBaseUrl()
): string =>
	getServiceOrigin('REACT_APP_AGENCY_SERVICE_ORIGIN', fallbackOrigin);

export const getConsultingTypeServiceOrigin = (
	fallbackOrigin = getRuntimeApiBaseUrl()
): string =>
	getServiceOrigin(
		'REACT_APP_CONSULTING_TYPE_SERVICE_ORIGIN',
		fallbackOrigin
	);

export const getKeycloakOrigin = (
	fallbackOrigin = getRuntimeApiBaseUrl()
): string => getServiceOrigin('REACT_APP_KEYCLOAK_ORIGIN', fallbackOrigin);

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

export const getMatrixRtcMembershipReaderUserId = (): string =>
	pickValue('REACT_APP_MATRIXRTC_MEMBERSHIP_READER_USER_ID') || '';

/**
 * LiveKit signalling websocket URL (wss).
 */
export const getLiveKitWsUrl = (): string =>
	ensureWebsocket(
		pickValue('REACT_APP_LIVEKIT_WS_URL', 'REACT_APP_LIVEKIT_URL')
	);

export const getKeycloakRealm = (): string => {
	const realm = pickValue('REACT_APP_KEYCLOAK_REALM', 'VITE_KEYCLOAK_REALM');
	if (!realm) {
		throw new Error('[config] REACT_APP_KEYCLOAK_REALM is not set.');
	}
	return realm;
};

export const getKeycloakAuthPath = (path: string): string => {
	const realm = getKeycloakRealm();
	return `/auth/realms/${realm}${path}`;
};

export const getCookieDomain = (): string | undefined =>
	pickValue('REACT_APP_COOKIE_DOMAIN', 'VITE_COOKIE_DOMAIN');

export const getHostnamesWithoutCookieDomain = (): string[] => {
	const raw = pickValue('REACT_APP_HOSTNAMES_WITHOUT_COOKIE_DOMAIN');
	if (!raw) {
		return [];
	}

	return raw
		.split(',')
		.map((entry) => entry.trim())
		.filter(Boolean);
};

export const getLocalTenantId = (): string | undefined =>
	pickValue('REACT_APP_LOCAL_TENANT_ID');

export const getElementUrl = (): string =>
	stripTrailingSlashes(
		ensureHttps(
			pickValue('REACT_APP_ELEMENT_URL', 'REACT_APP_ELEMENT_BASE_URL')
		)
	);

// Same-origin on purpose, not a guess: the app serves /impressum and
// /datenschutz itself (routePathNames). Documented exception, ORISO-Helm#368.
export const getOrganizationHomeUrl = (): string =>
	pickValue('REACT_APP_ORGANIZATION_HOME_URL') ||
	(typeof window !== 'undefined' ? window.location.origin : '');

export const getOrganizationOnlineBeratungUrl = (): string =>
	pickValue('REACT_APP_ORGANIZATION_ONLINEBERATUNG_URL') ||
	getOrganizationHomeUrl();

export const getLegalImprintUrl = (
	baseUrl = getOrganizationHomeUrl()
): string => pickValue('REACT_APP_LEGAL_IMPRINT_URL') || `${baseUrl}/impressum`;

export const getLegalPrivacyUrl = (
	baseUrl = getOrganizationHomeUrl()
): string =>
	pickValue('REACT_APP_LEGAL_PRIVACY_URL') || `${baseUrl}/datenschutz`;

export const getUseHttps = (): boolean => {
	const value = pickValue('REACT_APP_USE_HTTPS', 'VITE_USE_HTTPS');
	return value !== 'false';
};

/**
 * Keys the app cannot run without. Each entry lists the primary key first,
 * then accepted aliases. Helm renders all of them (frontend-configmap).
 */
const REQUIRED_RUNTIME_CONFIG: ReadonlyArray<{
	keys: readonly string[];
	/** Returns the normalised URL; absent for non-URL keys. */
	readUrl?: () => string;
}> = [
	{
		keys: ['REACT_APP_API_URL', 'VITE_API_URL'],
		readUrl: getRuntimeApiBaseUrl
	},
	{
		keys: [
			'REACT_APP_MATRIX_HOMESERVER_URL',
			'VITE_MATRIX_HOMESERVER_URL',
			'REACT_APP_MATRIX_URL'
		],
		readUrl: getMatrixHomeserverUrl
	},
	{
		keys: ['REACT_APP_ELEMENT_CALL_BASE_URL', 'REACT_APP_ELEMENT_CALL_URL'],
		readUrl: getElementCallBaseUrl
	},
	{
		keys: ['REACT_APP_LIVEKIT_WS_URL', 'REACT_APP_LIVEKIT_URL'],
		readUrl: getLiveKitWsUrl
	},
	{
		keys: ['REACT_APP_KEYCLOAK_REALM', 'VITE_KEYCLOAK_REALM']
	}
];

const isUsableUrl = (value: string): boolean => {
	try {
		return Boolean(new URL(value).hostname);
	} catch {
		return false;
	}
};

export interface RuntimeConfigProblem {
	key: string;
	problem: 'missing' | 'invalid';
}

/**
 * Required keys that are missing or unusable, named by their primary key.
 * Empty when the runtime config is complete.
 */
export const getRuntimeConfigProblems = (): RuntimeConfigProblem[] =>
	REQUIRED_RUNTIME_CONFIG.flatMap<RuntimeConfigProblem>(
		({ keys, readUrl }) => {
			const [key] = keys;
			if (!pickValue(...keys)) {
				return [{ key, problem: 'missing' }];
			}
			if (readUrl && !isUsableUrl(readUrl())) {
				return [{ key, problem: 'invalid' }];
			}
			return [];
		}
	);
