// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Service URLs come only from explicit runtime config (ORISO-Helm#368).
// A missing key is reported by name; it is never guessed from the page host.

const COMPLETE_CONFIG = {
	REACT_APP_API_URL: 'https://app.example.org',
	REACT_APP_MATRIX_HOMESERVER_URL: 'https://app.example.org',
	REACT_APP_ELEMENT_CALL_BASE_URL: 'https://app.example.org',
	REACT_APP_LIVEKIT_WS_URL: 'wss://app.example.org/livekit/sfu',
	REACT_APP_KEYCLOAK_REALM: 'online-beratung'
};

const RUNTIME_KEYS = [
	...Object.keys(COMPLETE_CONFIG),
	'VITE_API_URL',
	'VITE_MATRIX_HOMESERVER_URL',
	'REACT_APP_MATRIX_URL',
	'REACT_APP_ELEMENT_CALL_URL',
	'REACT_APP_LIVEKIT_URL',
	'VITE_KEYCLOAK_REALM'
];

const loadConfig = async (config: Record<string, string | undefined>) => {
	(window as any).__ORISO_RUNTIME_CONFIG__ = config;
	vi.resetModules();
	return import('./runtimeConfig');
};

const setPageUrl = (url: string) => {
	(globalThis as any).jsdom.reconfigure({ url });
};

describe('required runtime config', () => {
	const savedEnv: Record<string, string | undefined> = {};

	beforeEach(() => {
		delete (window as any).__ORISO_RUNTIME_CONFIG__;
		for (const key of RUNTIME_KEYS) {
			savedEnv[key] = process.env[key];
			delete process.env[key];
		}
	});

	afterEach(() => {
		for (const key of RUNTIME_KEYS) {
			if (savedEnv[key] === undefined) {
				delete process.env[key];
			} else {
				process.env[key] = savedEnv[key];
			}
		}
		setPageUrl('http://localhost:3000/');
	});

	it('does not derive service hosts from an app.* page host', async () => {
		setPageUrl('https://app.example.org/login');
		const config = await loadConfig({});

		expect(config.getRuntimeApiBaseUrl()).toBe('');
		expect(config.getMatrixHomeserverUrl()).toBe('');
		expect(config.getElementCallBaseUrl()).toBe('');
		expect(config.getLiveKitWsUrl()).toBe('');
	});

	it('names every missing required key', async () => {
		const { getRuntimeConfigProblems } = await loadConfig({});

		expect(getRuntimeConfigProblems()).toEqual([
			{ key: 'REACT_APP_API_URL', problem: 'missing' },
			{ key: 'REACT_APP_MATRIX_HOMESERVER_URL', problem: 'missing' },
			{ key: 'REACT_APP_ELEMENT_CALL_BASE_URL', problem: 'missing' },
			{ key: 'REACT_APP_LIVEKIT_WS_URL', problem: 'missing' },
			{ key: 'REACT_APP_KEYCLOAK_REALM', problem: 'missing' }
		]);
	});

	it('treats blank values as missing', async () => {
		const { getRuntimeConfigProblems } = await loadConfig({
			...COMPLETE_CONFIG,
			REACT_APP_API_URL: '   '
		});

		expect(getRuntimeConfigProblems()).toEqual([
			{ key: 'REACT_APP_API_URL', problem: 'missing' }
		]);
	});

	it('rejects a value that is not a usable URL', async () => {
		const { getRuntimeConfigProblems } = await loadConfig({
			...COMPLETE_CONFIG,
			REACT_APP_MATRIX_HOMESERVER_URL: 'https://'
		});

		expect(getRuntimeConfigProblems()).toEqual([
			{ key: 'REACT_APP_MATRIX_HOMESERVER_URL', problem: 'invalid' }
		]);
	});

	it('accepts the documented alias keys', async () => {
		const { getRuntimeConfigProblems } = await loadConfig({
			VITE_API_URL: 'https://app.example.org',
			REACT_APP_MATRIX_URL: 'https://app.example.org',
			REACT_APP_ELEMENT_CALL_URL: 'https://app.example.org',
			REACT_APP_LIVEKIT_URL: 'wss://app.example.org/livekit/sfu',
			VITE_KEYCLOAK_REALM: 'online-beratung'
		});

		expect(getRuntimeConfigProblems()).toEqual([]);
	});

	it('reports nothing when every required key is set', async () => {
		const { getRuntimeConfigProblems } = await loadConfig(COMPLETE_CONFIG);

		expect(getRuntimeConfigProblems()).toEqual([]);
	});
});
