import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import {
	decodeBase64,
	encodeUnpaddedBase64Url
} from 'matrix-js-sdk/lib/base64';
import {
	SECRET_STORAGE_ALGORITHM_V1_AES,
	type SecretStorageKeyDescriptionAesV1,
	type ServerSideSecretStorage
} from 'matrix-js-sdk/lib/secret-storage';
import { getDraftAuthSessionIdentity } from './draftAuthSession';
import { readRecoveryRoot } from './matrixRecoveryAccountData';

export const DRAFT_KEY_SECRET = 'org.oriso.draft_key.v1';
const SCOPE_PREFIX = 'draft.v1.';
const SCOPE_PATTERN = /^draft\.v1\.[A-Za-z0-9_-]{43}$/;
const ENVELOPE_PATTERN = /^draft\.v1\.([A-Za-z0-9_-]{16})\.([A-Za-z0-9_-]+)$/;
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });

export const isOpaqueDraftScope = (value: unknown): value is string =>
	typeof value === 'string' && SCOPE_PATTERN.test(value);

export interface DraftCryptography {
	opaqueScope(logicalScope: string): Promise<string>;
	seal(opaqueScope: string, value: unknown): Promise<string>;
	open(opaqueScope: string, envelope: string): Promise<unknown>;
}

type DraftKeys = { scope: CryptoKey; envelope: CryptoKey };

type DraftSession = {
	owner: object;
	client: MatrixClient;
	userId: string;
	appIdentity: string;
	cryptography: DraftCryptography | null;
	keys: DraftKeys | null;
	rootId: string | null;
};

let active: DraftSession | null = null;
const listeners = new Set<() => void>();

const publish = () => listeners.forEach((listener) => listener());

const dropDraftKeys = (session: DraftSession | null): boolean => {
	if (!session) return false;
	const wasReady = session.cryptography !== null;
	session.cryptography = null;
	session.keys = null;
	return wasReady;
};

const hasCurrentAppIdentity = (session: DraftSession): boolean =>
	getDraftAuthSessionIdentity() === session.appIdentity;

export const getDraftCryptography = (): DraftCryptography | null =>
	active?.cryptography && hasCurrentAppIdentity(active)
		? active.cryptography
		: null;

export const subscribeDraftCryptography = (
	listener: () => void
): (() => void) => {
	listeners.add(listener);
	return () => listeners.delete(listener);
};

export const bindDraftCryptographyClient = (
	owner: object,
	client: MatrixClient,
	userId: string
): void => {
	const appIdentity = getDraftAuthSessionIdentity();
	if (!appIdentity) {
		unbindDraftCryptographyClient(owner);
		return;
	}
	if (
		active?.owner === owner &&
		active.userId === userId &&
		active.appIdentity === appIdentity
	) {
		// Matrix token renewal replaces the SDK client in this same session.
		active.client = client;
		return;
	}
	const wasReady = dropDraftKeys(active);
	active = {
		owner,
		client,
		userId,
		appIdentity,
		cryptography: null,
		keys: null,
		rootId: null
	};
	if (wasReady) publish();
};

export const unbindDraftCryptographyClient = (owner: object): void => {
	if (active?.owner !== owner) return;
	const wasReady = dropDraftKeys(active);
	active = null;
	if (wasReady) publish();
};

export const clearDraftCryptography = (client: MatrixClient): void => {
	if (active?.client !== client) return;
	const wasReady = dropDraftKeys(active);
	// A different binding also invalidates an unlock already awaiting 4S.
	active = { ...active, rootId: null };
	if (wasReady) publish();
};

export const handleDraftRecoveryAccountData = (
	client: MatrixClient,
	event: MatrixEvent
): void => {
	if (
		active?.client === client &&
		active.rootId &&
		event.getType() === 'm.secret_storage.default_key' &&
		event.getContent().key !== active.rootId
	)
		clearDraftCryptography(client);
};

const domain = (purpose: string, userId: string, value?: string) =>
	encoder.encode(
		JSON.stringify(['org.oriso.draft', 1, purpose, userId, value])
	);

const hkdf = (purpose: string, userId: string): HkdfParams => ({
	name: 'HKDF',
	hash: 'SHA-256',
	salt: encoder.encode('org.oriso.draft.v1'),
	info: domain(purpose, userId)
});

const importSeed = async (value: Uint8Array, usage: KeyUsage) => {
	try {
		return await crypto.subtle.importKey('raw', value, 'HKDF', false, [
			usage
		]);
	} finally {
		value.fill(0);
	}
};

const toBytes = (encoded: string): Uint8Array => {
	const value = Uint8Array.from(decodeBase64(encoded));
	if (encodeUnpaddedBase64Url(value) !== encoded)
		throw new Error('Invalid draft encoding');
	return value;
};

const deriveInitialSecret = async (
	rootKey: Uint8Array,
	userId: string
): Promise<string> => {
	const root = await importSeed(Uint8Array.from(rootKey), 'deriveBits');
	const seed = new Uint8Array(
		await crypto.subtle.deriveBits(hkdf('initial-seed', userId), root, 256)
	);
	try {
		return encodeUnpaddedBase64Url(seed);
	} finally {
		seed.fill(0);
	}
};

const deriveDraftKeys = async (
	userId: string,
	secret: string
): Promise<DraftKeys> => {
	const material = toBytes(secret);
	if (material.length !== 32) {
		material.fill(0);
		throw new Error('Invalid draft encryption key');
	}
	const seed = await importSeed(material, 'deriveKey');
	const [scope, envelope] = await Promise.all([
		crypto.subtle.deriveKey(
			hkdf('scope-key', userId),
			seed,
			{ name: 'HMAC', hash: 'SHA-256', length: 256 },
			false,
			['sign']
		),
		crypto.subtle.deriveKey(
			hkdf('envelope-key', userId),
			seed,
			{ name: 'AES-GCM', length: 256 },
			false,
			['encrypt', 'decrypt']
		)
	]);

	return { scope, envelope };
};

const makeCryptography = (session: DraftSession): DraftCryptography => {
	const requireCurrent = (): DraftKeys => {
		if (
			active !== session ||
			!hasCurrentAppIdentity(session) ||
			session.cryptography !== cryptography ||
			!session.keys
		)
			throw new Error('Draft encryption is locked');
		return session.keys;
	};
	const envelopeParams = (scope: string, iv: Uint8Array): AesGcmParams => {
		if (!isOpaqueDraftScope(scope)) throw new Error('Invalid draft scope');
		return {
			name: 'AES-GCM',
			iv,
			additionalData: domain('envelope', session.userId, scope)
		};
	};
	const cryptography: DraftCryptography = {
		async opaqueScope(logicalScope) {
			const key = requireCurrent().scope;
			const signature = await crypto.subtle.sign(
				'HMAC',
				key,
				domain('scope', session.userId, logicalScope)
			);
			requireCurrent();
			return (
				SCOPE_PREFIX +
				encodeUnpaddedBase64Url(new Uint8Array(signature))
			);
		},
		async seal(scope, value) {
			const key = requireCurrent().envelope;
			const json = JSON.stringify(value);
			if (json === undefined) throw new Error('Invalid draft content');
			const iv = crypto.getRandomValues(new Uint8Array(12));
			const encrypted = await crypto.subtle.encrypt(
				envelopeParams(scope, iv),
				key,
				encoder.encode(json)
			);
			requireCurrent();
			return (
				SCOPE_PREFIX +
				encodeUnpaddedBase64Url(iv) +
				'.' +
				encodeUnpaddedBase64Url(new Uint8Array(encrypted))
			);
		},
		async open(scope, envelope) {
			const key = requireCurrent().envelope;
			const parts = ENVELOPE_PATTERN.exec(envelope);
			if (!parts) throw new Error('Invalid draft envelope');
			const plaintext = await crypto.subtle.decrypt(
				envelopeParams(scope, toBytes(parts[1])),
				key,
				toBytes(parts[2])
			);
			requireCurrent();
			return JSON.parse(decoder.decode(plaintext)) as unknown;
		}
	};
	return cryptography;
};

export const unlockDraftCryptography = async (
	client: MatrixClient,
	storage: Pick<ServerSideSecretStorage, 'get' | 'store'>,
	rootKey: Uint8Array,
	signal: AbortSignal,
	expectedRootId?: string
): Promise<void> => {
	const session = active;
	if (session?.client !== client || !hasCurrentAppIdentity(session)) return;

	const requireCurrent = () => {
		signal.throwIfAborted();
		if (
			active !== session ||
			session.client !== client ||
			!hasCurrentAppIdentity(session)
		)
			throw new Error('Draft recovery session changed');
	};
	const root = await readRecoveryRoot(client);
	requireCurrent();
	if (
		!root ||
		(expectedRootId && root[0] !== expectedRootId) ||
		root[1].algorithm !== SECRET_STORAGE_ALGORITHM_V1_AES ||
		!(await client.secretStorage.checkKey(
			rootKey,
			root[1] as SecretStorageKeyDescriptionAesV1
		))
	)
		throw new Error('Verified draft recovery root unavailable');

	const verifyCurrentRoot = async () => {
		const currentRoot = await readRecoveryRoot(client);
		requireCurrent();
		if (currentRoot?.[0] !== root[0])
			throw new Error('Draft recovery root changed');
	};

	requireCurrent();
	let secret = await storage.get(DRAFT_KEY_SECRET);
	requireCurrent();
	if (secret === undefined) {
		// Two devices with the same verified 4S root may both see no entry.
		// Purpose separation gives them the same independent draft seed.
		const initial = await deriveInitialSecret(rootKey, session.userId);
		await verifyCurrentRoot();
		await storage.store(DRAFT_KEY_SECRET, initial, [root[0]]);
		requireCurrent();
		secret = await storage.get(DRAFT_KEY_SECRET);
		requireCurrent();
		if (secret !== initial)
			throw new Error('Draft encryption key could not be verified');
	}

	const keys = await deriveDraftKeys(session.userId, secret);
	await verifyCurrentRoot();
	session.rootId = root[0];
	session.keys = keys;
	session.cryptography = makeCryptography(session);
	publish();
};
