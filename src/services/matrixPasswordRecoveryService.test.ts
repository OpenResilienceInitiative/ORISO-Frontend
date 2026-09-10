// @vitest-environment node
import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	ServerSideSecretStorageImpl,
	SECRET_STORAGE_ALGORITHM_V1_AES
} from 'matrix-js-sdk/lib/secret-storage';
import { RustCrypto } from 'matrix-js-sdk/lib/rust-crypto/rust-crypto';
import { ClientEvent } from 'matrix-js-sdk';
import { encodeRecoveryKey } from 'matrix-js-sdk/lib/crypto-api';
import {
	enrollPasswordRecovery,
	enrollPasswordRecoveryAfterKeyRecovery,
	PasswordRecoveryRepairBlockedError,
	recoverWithLoginPassword,
	changePasswordWithRecovery,
	PASSWORD_RECOVERY_SECRET,
	PASSWORD_RECOVERY_METADATA,
	PASSWORD_RECOVERY_CANDIDATE_PREFIX
} from './matrixPasswordRecoveryService';
import {
	recoverWithKey,
	clearSecretStorageKeys,
	secretStorageKeyCallback,
	withSecretStorageKeys
} from './matrixKeyBackupService';
import { registerDeviceSigningAuth } from './matrixInteractiveAuth';

class Server extends EventEmitter {
	data = new Map<string, any>();
	async getAccountDataFromServer(name: string) {
		return structuredClone(this.data.get(name) ?? null);
	}
	async setAccountData(name: string, content: unknown) {
		this.data.set(name, structuredClone(content));
		this.emit(ClientEvent.AccountData, {
			getType: () => name,
			getContent: () => structuredClone(content)
		});
		return {};
	}
}
const rootBytes = new Uint8Array(32).fill(17);
const rootCode = encodeRecoveryKey(rootBytes);
const generate = (password?: string) =>
	RustCrypto.prototype.createRecoveryKeyFromPassphrase.call(
		{ RECOVERY_KEY_DERIVATION_ITERATIONS: 500000 },
		password
	);
const publicKeys = (id: string) =>
	Object.fromEntries(
		['master', 'self_signing', 'user_signing'].map((type) => [
			`${type}_keys`,
			{ [id]: { keys: { [`ed25519:public-${type}`]: `public-${type}` } } }
		])
	);
function device(server: Server, userId = '@synthetic:test') {
	const crypto = {
		createRecoveryKeyFromPassphrase: vi.fn(generate),
		getKeyBackupInfo: vi.fn(async () => ({
			version: 'stable-backup',
			auth_data: { public_key: 'stable-public-key' }
		})),
		loadSessionBackupPrivateKeyFromSecretStorage: vi.fn(async () => {
			expect(await client.secretStorage.get('m.megolm_backup.v1')).toBe(
				'synthetic-backup-secret'
			);
		}),
		restoreKeyBackup: vi.fn(async () => ({ imported: 2, total: 2 })),
		bootstrapCrossSigning: vi.fn(async () => undefined),
		importSecretsBundle: vi.fn(async () => undefined),
		userHasCrossSigningKeys: vi.fn(async () => true),
		getCrossSigningStatus: vi.fn(async () => ({
			privateKeysCachedLocally: {
				masterKey: true,
				selfSigningKey: true,
				userSigningKey: true
			}
		})),
		crossSignDevice: vi.fn(async () => undefined),
		getCrossSigningKeyId: vi.fn(async (type) => `public-${type}`),
		resetEncryption: vi.fn()
	};
	const client: any = {
		getUserId: () => userId,
		getDeviceId: () => 'synthetic-device',
		downloadKeysForUsers: async () => publicKeys(userId),
		store: { accountData: new Map() },
		http: {
			authedRequest: async (_method: string, path: string) =>
				path === '/keys/query'
					? publicKeys(userId)
					: path === '/sync'
						? {
								next_batch: 'unused',
								account_data: {
									events: [...server.data].map(
										([type, content]) => ({ type, content })
									)
								}
							}
						: server.getAccountDataFromServer(
								decodeURIComponent(path.split('/').pop()!)
							)
		},
		getCrypto: () => crypto,
		getAccountDataFromServer: server.getAccountDataFromServer.bind(server),
		setAccountData: server.setAccountData.bind(server)
	};
	client.secretStorage = new ServerSideSecretStorageImpl(server as any, {
		getSecretStorageKey: (keys, name) =>
			secretStorageKeyCallback(client, keys, name)
	});
	registerDeviceSigningAuth(client, vi.fn());
	return client;
}
let server: Server;
let first: any;
beforeEach(async () => {
	server = new Server();
	first = device(server);
	const { keyId } = await first.secretStorage.addKey(
		SECRET_STORAGE_ALGORITHM_V1_AES,
		{ key: rootBytes }
	);
	await first.secretStorage.setDefaultKeyId(keyId);
	await withSecretStorageKeys(first, new Map([[keyId, rootBytes]]), () =>
		first.secretStorage.store(
			'm.megolm_backup.v1',
			'synthetic-backup-secret',
			[keyId]
		)
	);
	await withSecretStorageKeys(
		first,
		new Map([[keyId, rootBytes]]),
		async () => {
			for (const name of [
				'm.cross_signing.master',
				'm.cross_signing.self_signing',
				'm.cross_signing.user_signing'
			])
				await first.secretStorage.store(
					name,
					'synthetic-cross-signing-seed',
					[keyId]
				);
		}
	);
});

const candidateEvents = () =>
	[...server.data].filter(
		([type, content]) =>
			type.startsWith(PASSWORD_RECOVERY_CANDIDATE_PREFIX) &&
			content.encrypted
	);

describe('native SDK envelope around the unchanged root (transport and backup API fixtures)', () => {
	it('restores through an independent SDK instance and preserves the saved recovery key', async () => {
		const root = await first.secretStorage.getDefaultKeyId();
		const backup = structuredClone(server.data.get('m.megolm_backup.v1'));
		await enrollPasswordRecovery(first, 'synthetic-password', rootCode, 2);
		expect(await first.secretStorage.getDefaultKeyId()).toBe(root);
		expect(server.data.get('m.megolm_backup.v1')).toEqual(backup);
		expect(
			await recoverWithLoginPassword(device(server), 'synthetic-password')
		).toEqual({ kind: 'ready' });
		await expect(recoverWithKey(device(server), rootCode)).resolves.toEqual(
			{ imported: 2, total: 2 }
		);
		expect(JSON.stringify([...server.data])).not.toContain(rootCode);
		expect(JSON.stringify([...server.data])).not.toContain(
			'synthetic-password'
		);
	});
	it('rejects incorrect passwords and identity substitution without reset', async () => {
		await enrollPasswordRecovery(first, 'synthetic-password', rootCode, 2);
		const fresh = device(server);
		expect(await recoverWithLoginPassword(fresh, 'wrong')).toEqual({
			kind: 'needs-recovery-key'
		});
		expect(
			await recoverWithLoginPassword(
				device(server, '@other:test'),
				'synthetic-password'
			)
		).toEqual({ kind: 'needs-recovery-key' });
		expect(fresh.getCrypto().resetEncryption).not.toHaveBeenCalled();
	});
	it('reports unknown/missing metadata and network failures without treating the account as fresh', async () => {
		expect(
			await recoverWithLoginPassword(first, 'synthetic-password')
		).toEqual({ kind: 'not-enrolled' });
		await enrollPasswordRecovery(first, 'synthetic-password', rootCode, 2);
		server.data.delete(PASSWORD_RECOVERY_METADATA);
		expect(
			await recoverWithLoginPassword(first, 'synthetic-password')
		).toEqual({ kind: 'retryable-failure' });
		server.data.set(PASSWORD_RECOVERY_METADATA, { schemaVersion: 42 });
		expect(
			await recoverWithLoginPassword(first, 'synthetic-password')
		).toEqual({ kind: 'retryable-failure' });
		first.http.authedRequest = vi
			.fn()
			.mockRejectedValue(new Error('network'));
		expect(
			await recoverWithLoginPassword(first, 'synthetic-password')
		).toEqual({ kind: 'retryable-failure' });
	});

	it('stages a separately addressed candidate before updating credentials and retires the original wrapping', async () => {
		await enrollPasswordRecovery(first, 'old-synthetic', rootCode, 2);
		await changePasswordWithRecovery(
			first,
			'old-synthetic',
			'new-synthetic',
			async () => {
				expect(candidateEvents()).toHaveLength(1);
				expect(
					server.data.get(PASSWORD_RECOVERY_SECRET).encrypted
				).toBeTruthy();
			}
		);
		expect(server.data.get(PASSWORD_RECOVERY_SECRET)).toEqual({});
		expect(
			await recoverWithLoginPassword(device(server), 'new-synthetic')
		).toEqual({ kind: 'ready' });
		expect(
			await recoverWithLoginPassword(device(server), 'old-synthetic')
		).toEqual({ kind: 'needs-recovery-key' });
		await expect(recoverWithKey(device(server), rootCode)).resolves.toEqual(
			{ imported: 2, total: 2 }
		);
	});
	it('preserves the candidate on uncertain credential update and discovers it without active metadata or cached data', async () => {
		await enrollPasswordRecovery(first, 'old-synthetic', rootCode, 2);
		await expect(
			changePasswordWithRecovery(
				first,
				'old-synthetic',
				'new-synthetic',
				async () => {
					throw new Error('connection lost');
				}
			)
		).rejects.toThrow();
		expect(candidateEvents()).toHaveLength(1);
		server.data.delete(PASSWORD_RECOVERY_METADATA);
		const fresh = device(server);
		fresh.getAccountDataFromServer = vi.fn(async () => null);
		expect(fresh.store.accountData.size).toBe(0);
		expect(await recoverWithLoginPassword(fresh, 'new-synthetic')).toEqual({
			kind: 'ready'
		});
	});
	it('definite rejection deletes only its own candidate and leaves original recovery intact', async () => {
		await enrollPasswordRecovery(first, 'old-synthetic', rootCode, 2);
		await expect(
			changePasswordWithRecovery(
				first,
				'old-synthetic',
				'new-synthetic',
				async () => {
					throw new Error('BAD_REQUEST');
				},
				() => true
			)
		).rejects.toThrow();
		expect(candidateEvents()).toHaveLength(0);
		expect(
			await recoverWithLoginPassword(device(server), 'old-synthetic')
		).toEqual({ kind: 'ready' });
	});
	it('A-success/B-rejection interleaving cannot remove accepted A password recovery', async () => {
		await enrollPasswordRecovery(first, 'original-synthetic', rootCode, 2);
		let releaseA!: () => void;
		let reachedA!: () => void;
		const atA = new Promise<void>((resolve) => {
			reachedA = resolve;
		});
		const delayedA = new Promise<void>((resolve) => {
			releaseA = resolve;
		});
		const a = changePasswordWithRecovery(
			first,
			'original-synthetic',
			'password-a',
			async () => {
				reachedA();
				await delayedA;
			}
		);
		await atA;
		await expect(
			changePasswordWithRecovery(
				device(server),
				'original-synthetic',
				'password-b',
				async () => {
					throw new Error('BAD_REQUEST');
				},
				() => true
			)
		).rejects.toThrow();
		releaseA();
		await a;
		server.data.delete(PASSWORD_RECOVERY_METADATA);
		expect(candidateEvents()).toHaveLength(1);
		expect(
			await recoverWithLoginPassword(device(server), 'password-a')
		).toEqual({ kind: 'ready' });
	});
	it('delayed A success cannot recreate old wrapping after A-to-B change committed', async () => {
		await enrollPasswordRecovery(first, 'original-synthetic', rootCode, 2);
		let releaseA!: () => void;
		let reachedA!: () => void;
		const atA = new Promise<void>((resolve) => {
			reachedA = resolve;
		});
		const delayedA = new Promise<void>((resolve) => {
			releaseA = resolve;
		});
		const a = changePasswordWithRecovery(
			first,
			'original-synthetic',
			'password-a',
			async () => {
				reachedA();
				await delayedA;
			}
		);
		await atA;
		await changePasswordWithRecovery(
			device(server),
			'password-a',
			'password-b',
			async () => undefined
		);
		releaseA();
		await a;
		expect(candidateEvents()).toHaveLength(1);
		expect(server.data.get(PASSWORD_RECOVERY_SECRET)).toEqual({});
		expect(
			await recoverWithLoginPassword(device(server), 'password-b')
		).toEqual({ kind: 'ready' });
		expect(
			await recoverWithLoginPassword(device(server), 'password-a')
		).toEqual({ kind: 'needs-recovery-key' });
	});
	it('never bootstraps or replaces cross-signing when a stored private secret is missing', async () => {
		server.data.delete('m.cross_signing.self_signing');
		await expect(recoverWithKey(first, rootCode)).rejects.toThrow(
			'Existing cross-signing identity unavailable'
		);
		expect(first.getCrypto().bootstrapCrossSigning).not.toHaveBeenCalled();
		expect(first.getCrypto().resetEncryption).not.toHaveBeenCalled();
		expect(first.getCrypto().importSecretsBundle).not.toHaveBeenCalled();
	});

	it('blocks reset-password enrollment when prior password candidates cannot be retired safely', async () => {
		await enrollPasswordRecovery(first, 'original-synthetic', rootCode, 2);
		await changePasswordWithRecovery(
			first,
			'original-synthetic',
			'old-current',
			async () => undefined
		);
		const snapshot = structuredClone([...server.data]);
		await expect(
			enrollPasswordRecoveryAfterKeyRecovery(
				device(server),
				'forgotten-reset-new',
				rootCode,
				2
			)
		).rejects.toBeInstanceOf(PasswordRecoveryRepairBlockedError);
		expect([...server.data]).toEqual(snapshot);
		await expect(recoverWithKey(device(server), rootCode)).resolves.toEqual(
			{ imported: 2, total: 2 }
		);
	});
	it('rejects mismatching imported cross-signing public keys before signing the device', async () => {
		first
			.getCrypto()
			.getCrossSigningKeyId.mockResolvedValue('different-public-key');
		await expect(recoverWithKey(first, rootCode)).rejects.toThrow(
			'does not match'
		);
		expect(first.getCrypto().crossSignDevice).not.toHaveBeenCalled();
		expect(first.getCrypto().bootstrapCrossSigning).not.toHaveBeenCalled();
	});

	it('does not offer a temporary wrapping key to another client or the root ID', async () => {
		const root = await first.secretStorage.getKey();
		const other = device(server);
		await withSecretStorageKeys(
			first,
			new Map([['wrapper', new Uint8Array(32).fill(9)]]),
			async () => {
				expect(
					await secretStorageKeyCallback(
						first,
						{ keys: { [root[0]]: root[1] } },
						'm.megolm_backup.v1'
					)
				).toBeNull();
				expect(
					await secretStorageKeyCallback(
						other,
						{ keys: { [root[0]]: root[1] } },
						'm.megolm_backup.v1'
					)
				).toBeNull();
			}
		);
	});
	it('retains encrypted evidence after interrupted enrollment metadata write', async () => {
		first.setAccountData = vi.fn().mockRejectedValue(new Error('offline'));
		await expect(
			enrollPasswordRecovery(first, 'synthetic-password', rootCode, 2)
		).rejects.toThrow();
		expect(server.data.get(PASSWORD_RECOVERY_SECRET)).toBeTruthy();
		expect(
			await recoverWithLoginPassword(device(server), 'synthetic-password')
		).toEqual({ kind: 'retryable-failure' });
		expect(first.getCrypto().resetEncryption).not.toHaveBeenCalled();
	});
});

it('reads a legacy wrapper descriptor from the server even if primary SDK key cache is stale', async () => {
	await enrollPasswordRecovery(first, 'synthetic-password', rootCode, 2);
	const fresh = device(server);
	const original = fresh.secretStorage.getKey.bind(fresh.secretStorage);
	fresh.secretStorage.getKey = vi.fn((id?: string) =>
		id ? Promise.resolve(null) : original()
	);
	expect(await recoverWithLoginPassword(fresh, 'synthetic-password')).toEqual(
		{ kind: 'ready' }
	);
});
it('rejects overlapping scopes and cannot restore a finished scope', async () => {
	const root = await first.secretStorage.getKey();
	let finish: () => void;
	const pending = withSecretStorageKeys(
		first,
		new Map([[root[0], rootBytes]]),
		() =>
			new Promise<void>((resolve) => {
				finish = resolve;
			})
	);
	const run = vi.fn(async () => undefined);
	await expect(
		withSecretStorageKeys(first, new Map(), run)
	).rejects.toThrow();
	expect(run).not.toHaveBeenCalled();
	expect(
		await secretStorageKeyCallback(
			first,
			{ keys: { [root[0]]: root[1] } },
			'root'
		)
	).not.toBeNull();
	finish!();
	await pending;
	expect(
		await secretStorageKeyCallback(
			first,
			{ keys: { [root[0]]: root[1] } },
			'root'
		)
	).toBeNull();
	await expect(
		withSecretStorageKeys(first, new Map(), run)
	).resolves.toBeUndefined();
});

it('does not return a key when teardown occurs during asynchronous key validation', async () => {
	const root = await first.secretStorage.getKey();
	let checked: (valid: boolean) => void;
	first.secretStorage.checkKey = vi.fn(
		() =>
			new Promise<boolean>((resolve) => {
				checked = resolve;
			})
	);
	await withSecretStorageKeys(
		first,
		new Map([[root[0], rootBytes]]),
		async () => {
			const callback = secretStorageKeyCallback(
				first,
				{ keys: { [root[0]]: root[1] } },
				'root'
			);
			clearSecretStorageKeys(first);
			checked!(true);
			expect(await callback).toBeNull();
		}
	);
});
