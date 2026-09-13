// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	initializeChatRecovery,
	startAuthenticatedChatRecovery
} from './authenticatedChatRecovery';
import { getPendingRecoveryKey } from './pendingRecoveryKeyStore';
const status = vi.hoisted(() => vi.fn());
const setup = vi.hoisted(() => vi.fn());
const enroll = vi.hoisted(() => vi.fn());
const recover = vi.hoisted(() => vi.fn());
const evidence = vi.hoisted(() => vi.fn());
const runtimeStatus = vi.hoisted(() => vi.fn());
vi.mock('./recoveryReminderState', async (importOriginal) => ({
	...(await importOriginal<typeof import('./recoveryReminderState')>()),
	setRecoveryRuntimeStatus: runtimeStatus
}));
vi.mock('./matrixRecoveryAccountData', () => ({
	readRecoveryRoot: (client: any) => client.secretStorage.getKey()
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
	hasPasswordRecoveryEvidence: evidence
}));
const fresh = {
	serverBackupExists: false,
	secretStorageReady: false,
	keyStorageOutOfSync: false
};
const healthy = {
	serverBackupExists: true,
	secretStorageReady: true,
	keyStorageOutOfSync: false
};
const client = () =>
	({
		getUserId: () => '@synthetic:test',
		secretStorage: { getKey: vi.fn(async () => null) }
	}) as any;
beforeEach(() => {
	vi.clearAllMocks();
	localStorage.clear();
	status.mockResolvedValue(fresh);
	setup.mockResolvedValue('synthetic-key');
	recover.mockResolvedValue({ kind: 'not-enrolled' });
	evidence.mockResolvedValue(false);
});
describe('authenticated setup coordination', () => {
	it('creates ordinary recovery once and enrolls the exact same key for the immutable password mode', async () => {
		const c = client();
		await initializeChatRecovery(
			c,
			{ mode: 'LOGIN_PASSWORD', revision: 2 },
			'synthetic-password'
		);
		expect(setup).toHaveBeenCalledOnce();
		expect(enroll).toHaveBeenCalledWith(
			c,
			'synthetic-password',
			'synthetic-key',
			2
		);
		expect(getPendingRecoveryKey('@synthetic:test')).toBe('synthetic-key');
	});
	it('bootstraps legacy first-time accounts without migrating them to the password mode', async () => {
		await initializeChatRecovery(
			client(),
			{ mode: 'RECOVERY_KEY' },
			'synthetic-password'
		);
		expect(setup).toHaveBeenCalledOnce();
		expect(enroll).not.toHaveBeenCalled();
		expect(recover).not.toHaveBeenCalled();
	});
	it('never bootstraps on an interrupted envelope or a wrong password', async () => {
		evidence.mockResolvedValue(true);
		await initializeChatRecovery(client(), { mode: 'RECOVERY_KEY' }, null);
		expect(setup).not.toHaveBeenCalled();
		recover.mockResolvedValue({ kind: 'needs-recovery-key' });
		await initializeChatRecovery(
			client(),
			{ mode: 'LOGIN_PASSWORD', revision: 2 },
			'wrong'
		);
		expect(setup).not.toHaveBeenCalled();
		expect(enroll).not.toHaveBeenCalled();
	});
	it('does not reinterpret an existing root as fresh and does not invent a password after reload', async () => {
		const c = client();
		c.secretStorage.getKey.mockResolvedValue(['root', {}]);
		await initializeChatRecovery(
			c,
			{ mode: 'LOGIN_PASSWORD', revision: 2 },
			null
		);
		expect(setup).not.toHaveBeenCalled();
		expect(enroll).not.toHaveBeenCalled();
	});
	it('serializes two browser tabs and rechecks server state in the lock', async () => {
		let locked = false;
		vi.stubGlobal('navigator', {
			locks: {
				request: vi.fn(async (_name, _options, run) => {
					if (locked) return run(null);
					locked = true;
					try {
						return await run({ name: _name });
					} finally {
						locked = false;
					}
				})
			}
		});
		setup.mockImplementation(async () => {
			status.mockResolvedValue(healthy);
			return 'synthetic-key';
		});
		await Promise.all([
			initializeChatRecovery(client(), { mode: 'RECOVERY_KEY' }, null),
			initializeChatRecovery(client(), { mode: 'RECOVERY_KEY' }, null)
		]);
		expect(setup).toHaveBeenCalledOnce();
	});
	it('stops before setup after cancellation', async () => {
		await initializeChatRecovery(
			client(),
			{ mode: 'LOGIN_PASSWORD', revision: 2 },
			'synthetic-password',
			() => true
		);
		expect(setup).not.toHaveBeenCalled();
		expect(recover).not.toHaveBeenCalled();
	});
});

it('keeps reload verification in settings when existing device keys are usable', async () => {
	status.mockResolvedValue({
		...healthy,
		secretStorageReady: false,
		crossSigningReady: true,
		activeBackupVersion: '1'
	});
	await initializeChatRecovery(
		client(),
		{ mode: 'LOGIN_PASSWORD', revision: 2 },
		null
	);
	expect(runtimeStatus).toHaveBeenLastCalledWith(
		'@synthetic:test',
		'device-ready'
	);
	expect(enroll).not.toHaveBeenCalled();
	expect(recover).not.toHaveBeenCalled();
});
it('keeps the recovery action prominent when the local backup key is missing', async () => {
	status.mockResolvedValue({ ...healthy, keyStorageOutOfSync: true });
	await initializeChatRecovery(
		client(),
		{ mode: 'LOGIN_PASSWORD', revision: 2 },
		null
	);
	expect(runtimeStatus).toHaveBeenLastCalledWith(
		'@synthetic:test',
		'needs-recovery-key'
	);
});

it('parks a completed root for its original user even if the view cancels during setup', async () => {
	let cancelled = false;
	let finish: (key: string) => void;
	setup.mockImplementation(
		() =>
			new Promise<string>((resolve) => {
				finish = resolve;
			})
	);
	const run = initializeChatRecovery(
		client(),
		{ mode: 'LOGIN_PASSWORD', revision: 2 },
		'synthetic-password',
		() => cancelled
	);
	await vi.waitFor(() => expect(setup).toHaveBeenCalledOnce());
	cancelled = true;
	finish!('late-synthetic-key');
	await run;
	expect(getPendingRecoveryKey('@synthetic:test')).toBe('late-synthetic-key');
	expect(getPendingRecoveryKey('@other:test')).toBeNull();
	expect(enroll).not.toHaveBeenCalled();
});

afterEach(() => vi.unstubAllGlobals());
it('reports an occupied setup lease as busy without prompting for a key', async () => {
	vi.stubGlobal('navigator', {
		locks: { request: vi.fn(async (_name, _options, run) => run(null)) }
	});
	await initializeChatRecovery(client(), { mode: 'RECOVERY_KEY' }, null);
	expect(runtimeStatus).toHaveBeenLastCalledWith('@synthetic:test', 'busy');
	expect(setup).not.toHaveBeenCalled();
});

it('retries corrected immutable policy on the same client without losing its password', async () => {
	const { stageLoginRecoveryPassword, consumeLoginRecoveryPassword } =
		await import('./loginRecoveryHandoff');
	const c = client();
	const claimed = new WeakSet<object>();
	stageLoginRecoveryPassword('@synthetic:test', 'synthetic-password');
	expect(() =>
		startAuthenticatedChatRecovery(
			c,
			{
				chatRecoveryMode: 'LOGIN_PASSWORD',
				chatRecoveryPolicyRevision: null
			},
			claimed
		)
	).toThrow('Invalid chat recovery policy');
	expect(claimed.has(c)).toBe(false);
	await startAuthenticatedChatRecovery(
		c,
		{ chatRecoveryMode: 'LOGIN_PASSWORD', chatRecoveryPolicyRevision: 2 },
		claimed
	);
	expect(recover).toHaveBeenCalledWith(c, 'synthetic-password');
	await startAuthenticatedChatRecovery(
		c,
		{ chatRecoveryMode: 'LOGIN_PASSWORD', chatRecoveryPolicyRevision: 2 },
		claimed
	);
	expect(recover).toHaveBeenCalledOnce();
	expect(consumeLoginRecoveryPassword('@synthetic:test')).toBeNull();
});
