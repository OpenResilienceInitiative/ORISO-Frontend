// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';

/**
 * The chain LOGIN_PASSWORD recovery depends on: the sign-in stages the password, the app picks it
 * up on its first sync — in the NEXT document since #1492 — and seals the recovery key under it.
 * Each link was unit-tested on its own while the chain was broken on dev (21.09.): every counsellor
 * sign-in reached recovery without a password, so nothing was ever enrolled.
 */

// Stands in for IndexedDB: held by the test file, so it outlives a document load like the real one.
const keys = vi.hoisted(() => new Map<string, CryptoKey>());
vi.mock('./loginHandoffKeyStore', () => ({
	putHandoffKey: async (id: string, key: CryptoKey) => void keys.set(id, key),
	takeHandoffKey: async (id: string) => {
		const key = keys.get(id) ?? null;
		keys.delete(id);
		return key;
	},
	dropHandoffKey: (id: string) => void keys.delete(id)
}));

const status = vi.hoisted(() => vi.fn());
const setup = vi.hoisted(() => vi.fn());
const enroll = vi.hoisted(() => vi.fn());
const recover = vi.hoisted(() => vi.fn());
vi.mock('./recoveryReminderState', async (importOriginal) => ({
	...(await importOriginal<typeof import('./recoveryReminderState')>()),
	setRecoveryRuntimeStatus: vi.fn()
}));
vi.mock('./matrixRecoveryAccountData', () => ({
	readRecoveryRoot: async () => null
}));
vi.mock('./matrixKeyBackupService', () => ({
	getEncryptionStatus: status,
	setUpRecovery: setup,
	canBootstrapSilently: (s: any) =>
		!s.serverBackupExists && !s.secretStorageReady
}));
vi.mock('./matrixPasswordRecoveryService', () => ({
	enrollPasswordRecovery: enroll,
	recoverWithLoginPassword: recover,
	hasPasswordRecoveryEvidence: async () => false
}));

const USER = '@counsellor:synthetic';
const policy = {
	chatRecoveryMode: 'LOGIN_PASSWORD' as const,
	chatRecoveryPolicyRevision: 9
};
const client = { clientRunning: true, getUserId: () => USER } as any;

/** A full document load: module memory is gone, browser storage is not. */
const nextDocument = async () => {
	vi.resetModules();
	return {
		handoff: await import('./loginRecoveryHandoff'),
		recovery: await import('./authenticatedChatRecovery')
	};
};

beforeEach(() => {
	vi.clearAllMocks();
	sessionStorage.clear();
	localStorage.clear();
	keys.clear();
	status.mockResolvedValue({
		serverBackupExists: false,
		secretStorageReady: false,
		keyStorageOutOfSync: false
	});
	setup.mockResolvedValue('synthetic-recovery-key');
	recover.mockResolvedValue({ kind: 'not-enrolled' });
});

it('seals a new account’s recovery key under the password it signed in with, across the login document load', async () => {
	const login = await nextDocument();
	await login.handoff.stageLoginRecoveryPassword(USER, 'own-password');

	const app = await nextDocument();
	await app.recovery.startAuthenticatedChatRecovery(
		client,
		policy,
		new WeakSet()
	);

	expect(recover).toHaveBeenCalledWith(client, 'own-password');
	expect(enroll).toHaveBeenCalledWith(
		client,
		'own-password',
		'synthetic-recovery-key',
		9
	);
});

it('restores an enrolled account with the password after the load, without a new identity', async () => {
	recover.mockResolvedValue({ kind: 'ready' });
	const login = await nextDocument();
	await login.handoff.stageLoginRecoveryPassword(USER, 'own-password');

	const app = await nextDocument();
	await app.recovery.startAuthenticatedChatRecovery(
		client,
		policy,
		new WeakSet()
	);

	expect(recover).toHaveBeenCalledWith(client, 'own-password');
	expect(setup).not.toHaveBeenCalled();
	expect(enroll).not.toHaveBeenCalled();
});

it('never hands one account’s password to another account signing in next', async () => {
	const login = await nextDocument();
	await login.handoff.stageLoginRecoveryPassword(
		'@someone-else:synthetic',
		'their-password'
	);

	const app = await nextDocument();
	await app.recovery.startAuthenticatedChatRecovery(
		client,
		policy,
		new WeakSet()
	);

	expect(recover).not.toHaveBeenCalled();
	expect(enroll).not.toHaveBeenCalled();
});

it('uses the password once: a second load of the app does not see it again', async () => {
	const login = await nextDocument();
	await login.handoff.stageLoginRecoveryPassword(USER, 'own-password');
	const app = await nextDocument();
	await app.recovery.startAuthenticatedChatRecovery(
		client,
		policy,
		new WeakSet()
	);
	vi.clearAllMocks();

	const reloaded = await nextDocument();
	await reloaded.recovery.startAuthenticatedChatRecovery(
		client,
		policy,
		new WeakSet()
	);

	expect(recover).not.toHaveBeenCalled();
	expect(enroll).not.toHaveBeenCalled();
});
