// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

// Stands in for IndexedDB. Held by the test file, so it outlives the module
// reloads below exactly as a browser's IndexedDB outlives a document load.
const keys = vi.hoisted(() => new Map<string, CryptoKey>());
vi.mock('./loginHandoffKeyStore', () => ({
	putHandoffKey: async (key: CryptoKey) => void keys.set('k', key),
	takeHandoffKey: async () => {
		const key = keys.get('k') ?? null;
		keys.delete('k');
		return key;
	},
	dropHandoffKey: () => void keys.delete('k')
}));

type Handoff = typeof import('./loginRecoveryHandoff');
let handoff: Handoff;
/** A full document load: module memory is gone, browser storage is not. */
const documentLoad = async () => {
	vi.resetModules();
	handoff = await import('./loginRecoveryHandoff');
};

beforeEach(async () => {
	sessionStorage.clear();
	keys.clear();
	handoff = await import('./loginRecoveryHandoff');
});
afterEach(() => {
	handoff.clearLoginRecoveryPassword();
	vi.useRealTimers();
});

it('hands the password to only its authenticated identity, once', async () => {
	await handoff.stageLoginRecoveryPassword('@a:test', 'synthetic');
	expect(await handoff.consumeLoginRecoveryPassword('@a:test')).toBe(
		'synthetic'
	);
	expect(await handoff.consumeLoginRecoveryPassword('@a:test')).toBeNull();
});

it('drops the handoff on an account mismatch and on expiry', async () => {
	await handoff.stageLoginRecoveryPassword('@a:test', 'synthetic');
	expect(await handoff.consumeLoginRecoveryPassword('@b:test')).toBeNull();
	expect(await handoff.consumeLoginRecoveryPassword('@a:test')).toBeNull();
	vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
	await handoff.stageLoginRecoveryPassword('@a:test', 'synthetic');
	vi.advanceTimersByTime(120000);
	expect(await handoff.consumeLoginRecoveryPassword('@a:test')).toBeNull();
});

// #1402: login now ends in a document load, which wipes module memory. The
// app reads the password on its first sync, i.e. in the *next* document.
it('survives the document load between login and the authenticated app', async () => {
	await handoff.stageLoginRecoveryPassword('@a:test', 'synthetic');
	await documentLoad();
	expect(await handoff.consumeLoginRecoveryPassword('@a:test')).toBe(
		'synthetic'
	);
	await documentLoad();
	expect(await handoff.consumeLoginRecoveryPassword('@a:test')).toBeNull();
	expect(sessionStorage.length).toBe(0);
	expect(keys.size).toBe(0);
});

it('never leaves the password readable in session storage', async () => {
	await handoff.stageLoginRecoveryPassword('@a:test', 'synthetic-secret');
	const stored = Object.keys(sessionStorage)
		.map((key) => sessionStorage.getItem(key) ?? '')
		.join('');
	expect(stored).not.toBe('');
	expect(stored).not.toContain('synthetic-secret');
	expect(stored).not.toContain(btoa('synthetic-secret'));
});

it('does not carry an expired, foreign or cleared handoff across a load', async () => {
	vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
	await handoff.stageLoginRecoveryPassword('@a:test', 'synthetic');
	vi.advanceTimersByTime(120000);
	await documentLoad();
	expect(await handoff.consumeLoginRecoveryPassword('@a:test')).toBeNull();
	expect(sessionStorage.length).toBe(0);

	await handoff.stageLoginRecoveryPassword('@a:test', 'synthetic');
	await documentLoad();
	expect(await handoff.consumeLoginRecoveryPassword('@b:test')).toBeNull();
	expect(await handoff.consumeLoginRecoveryPassword('@a:test')).toBeNull();

	// Logout runs in the new document as well.
	await handoff.stageLoginRecoveryPassword('@a:test', 'synthetic');
	await documentLoad();
	handoff.clearLoginRecoveryPassword();
	expect(sessionStorage.length).toBe(0);
	expect(keys.size).toBe(0);
	expect(await handoff.consumeLoginRecoveryPassword('@a:test')).toBeNull();
});
