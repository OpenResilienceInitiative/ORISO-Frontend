#!/bin/sh
set -eu

export RUNTIME_CONFIG_FILE="${RUNTIME_CONFIG_FILE:-/app/build/config.js}"

node <<'NODE'
const fs = require('fs');
const path = require('path');

const pick = (...keys) => {
	for (const key of keys) {
		const value = process.env[key];
		if (value !== undefined && value !== '') {
			return value;
		}
	}
	return undefined;
};

const config = {};

const assignIfPresent = (configKey, ...envKeys) => {
	const value = pick(...envKeys);
	if (value !== undefined) {
		config[configKey] = value;
	}
};

assignIfPresent('REACT_APP_API_URL', 'REACT_APP_API_URL', 'VITE_API_URL');
assignIfPresent('VITE_API_URL', 'VITE_API_URL', 'REACT_APP_API_URL');
assignIfPresent('REACT_APP_USER_SERVICE_ORIGIN', 'REACT_APP_USER_SERVICE_ORIGIN');
assignIfPresent('REACT_APP_TENANT_SERVICE_ORIGIN', 'REACT_APP_TENANT_SERVICE_ORIGIN');
assignIfPresent('REACT_APP_LOCAL_TENANT_ID', 'REACT_APP_LOCAL_TENANT_ID');
assignIfPresent('REACT_APP_AGENCY_SERVICE_ORIGIN', 'REACT_APP_AGENCY_SERVICE_ORIGIN');
assignIfPresent(
	'REACT_APP_CONSULTING_TYPE_SERVICE_ORIGIN',
	'REACT_APP_CONSULTING_TYPE_SERVICE_ORIGIN'
);
assignIfPresent('REACT_APP_KEYCLOAK_ORIGIN', 'REACT_APP_KEYCLOAK_ORIGIN');
assignIfPresent(
	'REACT_APP_MATRIX_HOMESERVER_URL',
	'REACT_APP_MATRIX_HOMESERVER_URL',
	'VITE_MATRIX_HOMESERVER_URL',
	'REACT_APP_MATRIX_URL'
);
assignIfPresent(
	'VITE_MATRIX_HOMESERVER_URL',
	'VITE_MATRIX_HOMESERVER_URL',
	'REACT_APP_MATRIX_HOMESERVER_URL',
	'REACT_APP_MATRIX_URL'
);
assignIfPresent('REACT_APP_MATRIX_URL', 'REACT_APP_MATRIX_URL', 'REACT_APP_MATRIX_HOMESERVER_URL');
assignIfPresent(
	'REACT_APP_ELEMENT_CALL_BASE_URL',
	'REACT_APP_ELEMENT_CALL_BASE_URL',
	'REACT_APP_ELEMENT_CALL_URL'
);
assignIfPresent(
	'REACT_APP_ELEMENT_CALL_URL',
	'REACT_APP_ELEMENT_CALL_URL',
	'REACT_APP_ELEMENT_CALL_BASE_URL'
);
assignIfPresent(
	'REACT_APP_MATRIXRTC_MEMBERSHIP_READER_USER_ID',
	'REACT_APP_MATRIXRTC_MEMBERSHIP_READER_USER_ID'
);
assignIfPresent('REACT_APP_LIVEKIT_WS_URL', 'REACT_APP_LIVEKIT_WS_URL', 'REACT_APP_LIVEKIT_URL');
assignIfPresent('REACT_APP_LIVEKIT_URL', 'REACT_APP_LIVEKIT_URL', 'REACT_APP_LIVEKIT_WS_URL');
assignIfPresent('REACT_APP_KEYCLOAK_REALM', 'REACT_APP_KEYCLOAK_REALM', 'VITE_KEYCLOAK_REALM');
assignIfPresent('REACT_APP_COOKIE_DOMAIN', 'REACT_APP_COOKIE_DOMAIN', 'VITE_COOKIE_DOMAIN');
assignIfPresent(
	'REACT_APP_HOSTNAMES_WITHOUT_COOKIE_DOMAIN',
	'REACT_APP_HOSTNAMES_WITHOUT_COOKIE_DOMAIN'
);
assignIfPresent('REACT_APP_ELEMENT_URL', 'REACT_APP_ELEMENT_URL', 'REACT_APP_ELEMENT_BASE_URL');
assignIfPresent('REACT_APP_ELEMENT_BASE_URL', 'REACT_APP_ELEMENT_BASE_URL', 'REACT_APP_ELEMENT_URL');
assignIfPresent('REACT_APP_ORGANIZATION_HOME_URL', 'REACT_APP_ORGANIZATION_HOME_URL');
assignIfPresent(
	'REACT_APP_ORGANIZATION_ONLINEBERATUNG_URL',
	'REACT_APP_ORGANIZATION_ONLINEBERATUNG_URL'
);
assignIfPresent('REACT_APP_LEGAL_IMPRINT_URL', 'REACT_APP_LEGAL_IMPRINT_URL');
assignIfPresent('REACT_APP_LEGAL_PRIVACY_URL', 'REACT_APP_LEGAL_PRIVACY_URL');
assignIfPresent('REACT_APP_USE_HTTPS', 'REACT_APP_USE_HTTPS', 'VITE_USE_HTTPS');
assignIfPresent(
	'REACT_APP_OBSERVABILITY_ENABLED',
	'REACT_APP_OBSERVABILITY_ENABLED',
	'VITE_OBSERVABILITY_ENABLED'
);
// Media content scanner (ADR-019). Absent means no scanner is deployed, which
// is the normal case today; the client then keeps its previous media path.
assignIfPresent(
	'REACT_APP_MEDIA_SCANNER_URL',
	'REACT_APP_MEDIA_SCANNER_URL',
	'VITE_MEDIA_SCANNER_URL'
);
assignIfPresent(
	'REACT_APP_OTEL_METRICS_URL',
	'REACT_APP_OTEL_METRICS_URL',
	'VITE_OTEL_METRICS_URL'
);
assignIfPresent(
	'REACT_APP_OTEL_EXPORT_INTERVAL_MS',
	'REACT_APP_OTEL_EXPORT_INTERVAL_MS',
	'VITE_OTEL_EXPORT_INTERVAL_MS'
);
assignIfPresent(
	'REACT_APP_PLATFORM_VERSION',
	'REACT_APP_PLATFORM_VERSION',
	'VITE_PLATFORM_VERSION'
);
assignIfPresent(
	'VITE_PLATFORM_VERSION',
	'VITE_PLATFORM_VERSION',
	'REACT_APP_PLATFORM_VERSION'
);

// ORISO-Helm#368: the app never guesses a service URL, so a missing one must
// stop the container here, naming the variable, instead of shipping a
// config.js that only fails in the browser.
const REQUIRED = [
	{ key: 'REACT_APP_API_URL', url: true },
	{ key: 'REACT_APP_MATRIX_HOMESERVER_URL', url: true },
	{ key: 'REACT_APP_ELEMENT_CALL_BASE_URL', url: true },
	{ key: 'REACT_APP_LIVEKIT_WS_URL', url: true },
	{ key: 'REACT_APP_KEYCLOAK_REALM', url: false }
];

const isAbsoluteUrl = (value) => {
	try {
		const parsed = new URL(value);
		return /^(https?|wss?):$/.test(parsed.protocol) && Boolean(parsed.hostname);
	} catch {
		return false;
	}
};

const problems = REQUIRED.flatMap(({ key, url }) => {
	const value = String(config[key] ?? '').trim();
	if (!value) {
		return [`${key} is not set (or empty)`];
	}
	if (url && !isAbsoluteUrl(value)) {
		return [`${key} is not an absolute URL: ${JSON.stringify(value)}`];
	}
	return [];
});

if (problems.length > 0) {
	for (const problem of problems) {
		console.error(`[docker-entrypoint] ${problem}`);
	}
	console.error(
		'[docker-entrypoint] Refusing to start: set the variables above (Helm frontend-configmap).'
	);
	process.exit(1);
}

const target = process.env.RUNTIME_CONFIG_FILE;
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(
	target,
	`window.__ORISO_RUNTIME_CONFIG__ = ${JSON.stringify(config, null, 2)};\n`,
	'utf8'
);
NODE

exec "$@"
