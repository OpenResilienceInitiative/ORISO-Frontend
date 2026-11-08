import { MatrixEvent, type MatrixClient } from 'matrix-js-sdk';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import * as draft from './draftCryptography';

const { readRecoveryRoot } = vi.hoisted(() => ({
	readRecoveryRoot: vi.fn()
}));
vi.mock('./matrixRecoveryAccountData', () => ({ readRecoveryRoot }));

const owner = {};
const user = '@draft-author:example.org';
const rootKey = new Uint8Array(32).fill(7);
const rootId = 'matrix-4s-root';
const binding = (
	crypto: typeof draft = draft,
	session = owner,
	userId = user
) => {
	const client = {
		getUserId: () => userId,
		secretStorage: { checkKey: vi.fn().mockResolvedValue(true) }
	} as unknown as MatrixClient;
	crypto.bindDraftCryptographyClient(session, client, userId);
	return client;
};

const unlock = async (
	client: MatrixClient,
	storage = createStorage(),
	crypto: typeof draft = draft,
	signal = new AbortController().signal
) => {
	readRecoveryRoot.mockResolvedValue([
		rootId,
		{ algorithm: 'm.secret_storage.v1.aes-hmac-sha2' }
	]);
	await crypto.unlockDraftCryptography(
		client,
		storage,
		rootKey,
		signal,
		rootId
	);
	return crypto.getDraftCryptography();
};

const createStorage = (initial?: string) => {
	let stored = initial;
	return {
		get: vi.fn(async () => stored),
		store: vi.fn(async (_name: string, seed: string | null) => {
			stored = seed ?? undefined;
		})
	};
};

afterEach(() => {
	draft.unbindDraftCryptographyClient(owner);
	vi.clearAllMocks();
});

describe('draft cryptography', () => {
	it('uses opaque deterministic scope IDs and a randomized authenticated envelope', async () => {
		const storage = createStorage();
		const client = binding();
		expect(draft.getDraftCryptography()).toBeNull();
		const ready = vi.fn();
		const unsubscribe = draft.subscribeDraftCryptography(ready);
		const cryptography = (await unlock(client, storage))!;
		expect(ready).toHaveBeenCalledTimes(1);
		unsubscribe();

		const logicalScope = 'scope:!private:example.org|thread:$private';
		const scope = await cryptography.opaqueScope(logicalScope);
		const otherScope = await cryptography.opaqueScope(
			logicalScope + '-other'
		);
		expect(scope).toMatch(/^draft\.v1\.[A-Za-z0-9_-]{43}$/);
		expect(scope).not.toContain('private');
		expect(await cryptography.opaqueScope(logicalScope)).toBe(scope);
		expect(otherScope).not.toBe(scope);

		const value = {
			text: 'Vertraulicher Testentwurf',
			title: 'Beratung',
			actionPath: '/sessions/user/view/12'
		};
		const sealed = await cryptography.seal(scope, value);
		expect(sealed).toMatch(
			/^draft\.v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]+$/
		);
		expect(sealed).not.toContain(value.text);
		expect(sealed).not.toBe(await cryptography.seal(scope, value));
		expect(await cryptography.open(scope, sealed)).toEqual(value);
		await expect(cryptography.open(otherScope, sealed)).rejects.toThrow();
		const parts = sealed.split('.');
		const ciphertext = parts[3];
		parts[3] = (ciphertext[0] === 'A' ? 'B' : 'A') + ciphertext.slice(1);
		await expect(
			cryptography.open(scope, parts.join('.'))
		).rejects.toThrow();
		await expect(cryptography.open(scope, value.text)).rejects.toThrow();
		expect(storage.store).toHaveBeenCalledExactlyOnceWith(
			'org.oriso.draft_key.v1',
			expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
			[rootId]
		);
	});

	it('reads the same secret on a new device, keeps it during same-user refresh and clears old handles', async () => {
		const storage = createStorage();
		const first = (await unlock(binding(), storage))!;
		const scope = await first.opaqueScope('scope:example');
		const sealed = await first.seal(scope, 'Entwurf');

		const refresh = binding();
		expect(draft.getDraftCryptography()).toBe(first);
		expect(await first.open(scope, sealed)).toBe('Entwurf');
		draft.clearDraftCryptography(refresh);
		expect(draft.getDraftCryptography()).toBeNull();
		await expect(first.open(scope, sealed)).rejects.toThrow();

		const recovered = (await unlock(binding(), storage))!;
		expect(await recovered.opaqueScope('scope:example')).toBe(scope);
		expect(await recovered.open(scope, sealed)).toBe('Entwurf');
		expect(storage.store).toHaveBeenCalledTimes(1);

		const otherUser = '@different:example.org';
		const different = (await unlock(
			binding(draft, owner, otherUser),
			storage
		))!;
		expect(await different.opaqueScope('scope:example')).not.toBe(scope);
		await expect(different.open(scope, sealed)).rejects.toThrow();
		draft.unbindDraftCryptographyClient(owner);
		await expect(different.open(scope, sealed)).rejects.toThrow();
	});

	it('drops the live draft key if Matrix reports that the verified 4S root changed', async () => {
		const client = binding();
		const cryptography = (await unlock(client))!;
		const rootEvent = (key?: string) =>
			new MatrixEvent({
				type: 'm.secret_storage.default_key',
				content: key ? { key } : {}
			});

		draft.handleDraftRecoveryAccountData(client, rootEvent(rootId));
		expect(draft.getDraftCryptography()).toBe(cryptography);
		draft.handleDraftRecoveryAccountData(
			client,
			rootEvent('different-root')
		);
		expect(draft.getDraftCryptography()).toBeNull();
		await expect(cryptography.opaqueScope('scope:old')).rejects.toThrow();
	});

	it('rejects an encryption already in progress after the authenticated client is stopped', async () => {
		const cryptography = (await unlock(binding()))!;
		const scope = await cryptography.opaqueScope('scope:pending');
		const result = cryptography.seal(scope, 'No longer signed in');
		draft.unbindDraftCryptographyClient(owner);
		await expect(result).rejects.toThrow();
	});

	it('does not install an unverified write or replace an unreadable stored key', async () => {
		const client = binding();
		const storage = createStorage();
		storage.store.mockResolvedValueOnce(undefined);
		await expect(unlock(client, storage)).rejects.toThrow();
		expect(draft.getDraftCryptography()).toBeNull();

		const corrupt = createStorage('not-a-draft-key');
		await expect(unlock(client, corrupt)).rejects.toThrow();
		expect(corrupt.store).not.toHaveBeenCalled();
		expect(draft.getDraftCryptography()).toBeNull();
	});

	it('publishes no key after the recovery attempt is cancelled or replaced', async () => {
		const client = binding();
		const controller = new AbortController();
		let resumeRead!: (value: string | undefined) => void;
		const storage = createStorage();
		storage.get.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					resumeRead = resolve;
				})
		);
		const result = unlock(client, storage, draft, controller.signal);
		await vi.waitFor(() => expect(storage.get).toHaveBeenCalledTimes(1));
		controller.abort();
		binding(draft, owner, '@other:example.org');
		resumeRead(undefined);
		await expect(result).rejects.toThrow();
		expect(storage.store).not.toHaveBeenCalled();
		expect(draft.getDraftCryptography()).toBeNull();
	});

	it('provisions the same first key on two independent devices that both see no secret', async () => {
		const devices = [{}, {}];
		vi.resetModules();
		const otherDevice = await import('./draftCryptography');
		let reads = 0;
		let release!: () => void;
		const barrier = new Promise<void>((resolve) => {
			release = resolve;
		});
		const storage = createStorage();
		const firstRead = async () => {
			if (++reads === 2) release();
			await barrier;
			return undefined;
		};
		storage.get
			.mockImplementationOnce(firstRead)
			.mockImplementationOnce(firstRead);
		try {
			const [left, right] = await Promise.all([
				unlock(binding(draft, devices[0]), storage),
				unlock(binding(otherDevice, devices[1]), storage, otherDevice)
			]);
			const scope = await left!.opaqueScope('scope:one');
			expect(await right!.opaqueScope('scope:one')).toBe(scope);
			expect(
				await right!.open(scope, await left!.seal(scope, 'draft'))
			).toBe('draft');
			expect(storage.store.mock.calls).toHaveLength(2);
			expect(storage.store.mock.calls[0][1]).toBe(
				storage.store.mock.calls[1][1]
			);
		} finally {
			draft.unbindDraftCryptographyClient(devices[0]);
			otherDevice.unbindDraftCryptographyClient(devices[1]);
		}
	});
});
