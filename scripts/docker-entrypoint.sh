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

const target = process.env.RUNTIME_CONFIG_FILE;
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(
	target,
	`window.__ORISO_RUNTIME_CONFIG__ = ${JSON.stringify(config, null, 2)};\n`,
	'utf8'
);
NODE

exec "$@"
