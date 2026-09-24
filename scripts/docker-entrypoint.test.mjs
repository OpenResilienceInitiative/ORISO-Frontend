import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// ORISO-Helm#368: the container refuses to start when a required runtime URL
// is missing, and names it, instead of shipping a config.js the app cannot use.

const entrypoint = path.join(
	path.dirname(fileURLToPath(import.meta.url)),
	'docker-entrypoint.sh'
);

const COMPLETE_ENV = {
	REACT_APP_API_URL: 'https://app.example.org',
	REACT_APP_MATRIX_HOMESERVER_URL: 'https://app.example.org',
	REACT_APP_ELEMENT_CALL_BASE_URL: 'https://app.example.org',
	REACT_APP_LIVEKIT_WS_URL: 'wss://app.example.org/livekit/sfu',
	REACT_APP_KEYCLOAK_REALM: 'online-beratung'
};

const runEntrypoint = (env) => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fe-entrypoint-'));
	const configFile = path.join(dir, 'config.js');
	try {
		const result = spawnSync('sh', [entrypoint, 'true'], {
			encoding: 'utf8',
			env: {
				PATH: process.env.PATH,
				RUNTIME_CONFIG_FILE: configFile,
				...env
			}
		});
		const config = fs.existsSync(configFile)
			? fs.readFileSync(configFile, 'utf8')
			: null;
		return { ...result, config };
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
};

test('writes config.js when every required URL is set', () => {
	const result = runEntrypoint(COMPLETE_ENV);
	assert.equal(result.status, 0, result.stderr);
	assert.match(
		result.config,
		/"REACT_APP_API_URL": "https:\/\/app\.example\.org"/
	);
});

test('accepts the alias keys Helm renders', () => {
	const result = runEntrypoint({
		VITE_API_URL: 'https://app.example.org',
		VITE_MATRIX_HOMESERVER_URL: 'https://app.example.org',
		REACT_APP_ELEMENT_CALL_URL: 'https://app.example.org',
		REACT_APP_LIVEKIT_URL: 'wss://app.example.org/livekit/sfu',
		VITE_KEYCLOAK_REALM: 'online-beratung'
	});
	assert.equal(result.status, 0, result.stderr);
});

for (const key of Object.keys(COMPLETE_ENV)) {
	test(`fails and names ${key} when it is empty`, () => {
		const result = runEntrypoint({ ...COMPLETE_ENV, [key]: '' });
		assert.notEqual(result.status, 0);
		assert.match(result.stderr, new RegExp(key));
		assert.equal(result.config, null, 'no config.js on failure');
	});
}

test('names every missing key at once', () => {
	const result = runEntrypoint({});
	assert.notEqual(result.status, 0);
	for (const key of Object.keys(COMPLETE_ENV)) {
		assert.match(result.stderr, new RegExp(key));
	}
});

test('rejects a URL that is not absolute', () => {
	const result = runEntrypoint({
		...COMPLETE_ENV,
		REACT_APP_API_URL: '/service'
	});
	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /REACT_APP_API_URL/);
});
