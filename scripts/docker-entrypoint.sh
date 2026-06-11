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

const apiUrl = pick('REACT_APP_API_URL', 'VITE_API_URL');
const matrixHomeserverUrl = pick(
	'REACT_APP_MATRIX_HOMESERVER_URL',
	'VITE_MATRIX_HOMESERVER_URL',
	'REACT_APP_MATRIX_URL'
);
const elementCallUrl = pick(
	'REACT_APP_ELEMENT_CALL_BASE_URL',
	'REACT_APP_ELEMENT_CALL_URL'
);
const livekitUrl = pick('REACT_APP_LIVEKIT_WS_URL', 'REACT_APP_LIVEKIT_URL');

const config = {};

if (apiUrl) {
	config.REACT_APP_API_URL = apiUrl;
	config.VITE_API_URL = apiUrl;
}

if (matrixHomeserverUrl) {
	config.REACT_APP_MATRIX_HOMESERVER_URL = matrixHomeserverUrl;
	config.VITE_MATRIX_HOMESERVER_URL = matrixHomeserverUrl;
	config.REACT_APP_MATRIX_URL = matrixHomeserverUrl;
}

if (elementCallUrl) {
	config.REACT_APP_ELEMENT_CALL_BASE_URL = elementCallUrl;
	config.REACT_APP_ELEMENT_CALL_URL = elementCallUrl;
}

if (livekitUrl) {
	config.REACT_APP_LIVEKIT_WS_URL = livekitUrl;
	config.REACT_APP_LIVEKIT_URL = livekitUrl;
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
