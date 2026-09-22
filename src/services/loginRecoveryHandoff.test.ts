// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

// Stands in for IndexedDB. Held by the test file, so it outlives the module
// reloads below exactly as a browser's IndexedDB outlives a document load.
// `beforePut` lets a test hold or fail a key write.
const { keys, hooks } = vi.hoisted(() => ({
	keys: new Map<string, CryptoKey>(),
	hooks: { beforePut: undefined as undefined | (() => Promise<void>) }
}));
vi.mock('./loginHandoffKeyStore', () => ({
	putHandoffKey: async (id: string, key: CryptoKey) => {
		const before = hooks.beforePut;
		hooks.beforePut = undefined;
		await before?.();
		keys.set(id, key);
	},
	takeHandoffKey: async (id: string) => {
		const key = keys.get(id) ?? null;
		keys.delete(id);
		return key;
	},
	dropHandoffKey: (id: string) => void keys.delete(id)
}));

type Handoff = typeof import('./loginRecoveryHandoff');
let handoff: Handoff;
/**
 * A full document load: module memory is gone, browser storage is not — and
 * so are the old document's timers, which is why the expiry cannot live only
 * in the document that staged the handoff.
 */
const documentLoad = async () => {
	if (vi.isFakeTimers()) vi.clearAllTimers();
	vi.resetModules();
	handoff = await import('./loginRecoveryHandoff');
};

beforeEach(async () => {
	sessionStorage.clear();
	keys.clear();
	hooks.beforePut = undefined;
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

/* Review (CodeRabbit): the staging document's timer dies with it. If the next
   document never reads the handoff, it must still end after 120 s — not stay
   in session storage and IndexedDB until the tab closes. */
it('ends the handoff after 120 s in the next document even when nobody reads it', async () => {
	vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
	await handoff.stageLoginRecoveryPassword('@a:test', 'synthetic');
	await documentLoad();
	vi.advanceTimersByTime(119000);
	expect(sessionStorage.length).toBe(1);

	vi.advanceTimersByTime(1000);
	expect(sessionStorage.length).toBe(0);
	expect(keys.size).toBe(0);
});

it('drops a handoff that has already expired when the next document loads', async () => {
	await handoff.stageLoginRecoveryPassword('@a:test', 'synthetic');
	/* The entry as a later document finds it once its time is up. */
	const sealed = JSON.parse(
		sessionStorage.getItem('oriso.loginRecoveryHandoff') as string
	);
	sessionStorage.setItem(
		'oriso.loginRecoveryHandoff',
		JSON.stringify({ ...sealed, expiresAt: Date.now() - 1 })
	);
	await documentLoad();

	expect(sessionStorage.length).toBe(0);
	expect(keys.size).toBe(0);
	expect(await handoff.consumeLoginRecoveryPassword('@a:test')).toBeNull();
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

/** Everything queued behind the crypto and key-store awaits has run. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

// A logout (or any clear) while the seal is still encrypting must win: the
// seal may not write its key and ciphertext afterwards.
it('does not let a seal in flight outlive a clear', async () => {
	const staging = handoff.stageLoginRecoveryPassword('@a:test', 'synthetic');
	handoff.clearLoginRecoveryPassword();
	await staging;
	await settle();
	expect(sessionStorage.length).toBe(0);
	expect(keys.size).toBe(0);
	await documentLoad();
	expect(await handoff.consumeLoginRecoveryPassword('@a:test')).toBeNull();
});

it('does not let a seal in flight outlive the one read', async () => {
	const staging = handoff.stageLoginRecoveryPassword('@a:test', 'synthetic');
	expect(await handoff.consumeLoginRecoveryPassword('@a:test')).toBe(
		'synthetic'
	);
	await staging;
	await settle();
	expect(sessionStorage.length).toBe(0);
	expect(keys.size).toBe(0);
	await documentLoad();
	expect(await handoff.consumeLoginRecoveryPassword('@a:test')).toBeNull();
});

it('does not let a stale seal failure delete the newer handoff', async () => {
	let fail!: () => void;
	hooks.beforePut = () =>
		new Promise<void>((_, reject) => {
			fail = () => reject(new Error('synthetic put failure'));
		});
	const first = handoff.stageLoginRecoveryPassword('@a:test', 'first');
	await settle();
	await handoff.stageLoginRecoveryPassword('@a:test', 'second');
	fail();
	await first;
	await settle();
	await documentLoad();
	expect(await handoff.consumeLoginRecoveryPassword('@a:test')).toBe(
		'second'
	);
});

// IndexedDB is shared by every tab of the origin, session storage is not.
it('keeps the handoffs of two tabs logging in at once apart', async () => {
	const tab = async (userId: string, password: string) => {
		sessionStorage.clear();
		await documentLoad();
		await handoff.stageLoginRecoveryPassword(userId, password);
		const storage = { ...sessionStorage };
		sessionStorage.clear();
		return storage;
	};
	const load = async (storage: Record<string, string>) => {
		sessionStorage.clear();
		Object.entries(storage).forEach(([k, v]) =>
			sessionStorage.setItem(k, v)
		);
		await documentLoad();
	};
	const tabA = await tab('@a:test', 'synthetic-a');
	const tabB = await tab('@b:test', 'synthetic-b');

	await load(tabA);
	expect(await handoff.consumeLoginRecoveryPassword('@a:test')).toBe(
		'synthetic-a'
	);
	await load(tabB);
	expect(await handoff.consumeLoginRecoveryPassword('@b:test')).toBe(
		'synthetic-b'
	);
	expect(keys.size).toBe(0);
});

it('drops only its own key when a tab clears', async () => {
	await handoff.stageLoginRecoveryPassword('@b:test', 'synthetic-b');
	const tabB = { ...sessionStorage };
	sessionStorage.clear();
	await documentLoad();
	await handoff.stageLoginRecoveryPassword('@a:test', 'synthetic-a');
	await documentLoad();
	handoff.clearLoginRecoveryPassword();
	expect(keys.size).toBe(1);

	sessionStorage.clear();
	Object.entries(tabB).forEach(([k, v]) => sessionStorage.setItem(k, v));
	await documentLoad();
	expect(await handoff.consumeLoginRecoveryPassword('@b:test')).toBe(
		'synthetic-b'
	);
});
