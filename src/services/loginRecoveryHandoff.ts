import {
	dropHandoffKey,
	putHandoffKey,
	takeHandoffKey
} from './loginHandoffKeyStore';

/**
 * One-use credential handoff after complete authentication.
 *
 * Login ends in a document load (#1402), and the app reads the password on its
 * first sync — in the next document. So the handoff is kept twice: in memory
 * for a same-document handover (registration), and sealed for the load in
 * between: AES-GCM ciphertext in session storage, its non-extractable key in
 * IndexedDB. Neither half opens anything alone. Both halves still sit in the
 * browser profile, so what actually bounds the exposure is the rest: bound to
 * one Matrix identity, read at most once, dropped after 120 s, on logout, and
 * on the first read after the load whatever its outcome.
 */
const TTL_MS = 120000;
const STORAGE_KEY = 'oriso.loginRecoveryHandoff';

let pending: { userId: string; password: string; expiresAt: number } | null =
	null;
let expiry: ReturnType<typeof setTimeout> | undefined;
/** Id of the key this document staged, while it may still be in the store. */
let ownKeyId: string | null = null;
/**
 * Bumped by every stage, clear and consume. A seal still encrypting when one
 * of them runs is stale: it must not write its key or ciphertext afterwards,
 * and its failure must not clean up a newer handoff.
 */
let generation = 0;

/** `keyId` names this handoff's own key slot in the shared key store. */
type Sealed = {
	keyId: string;
	userId: string;
	expiresAt: number;
	iv: string;
	data: string;
};

const toBase64 = (bytes: ArrayBuffer | Uint8Array) =>
	btoa(String.fromCharCode(...new Uint8Array(bytes)));
const fromBase64 = (text: string) =>
	Uint8Array.from(atob(text), (char) => char.charCodeAt(0));

const newKeyId = () =>
	Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
		byte.toString(16).padStart(2, '0')
	).join('');

/** Takes the sealed entry off session storage, so a second reader finds nothing. */
const takeSealed = (): Sealed | null => {
	try {
		const raw = sessionStorage.getItem(STORAGE_KEY);
		sessionStorage.removeItem(STORAGE_KEY);
		return raw ? (JSON.parse(raw) as Sealed) : null;
	} catch {
		// Storage can be unavailable (private mode, blocked site data).
		return null;
	}
};

/** Drops this tab's key, never another tab's: only ids it knows of. */
const dropOwnKeys = (sealed: Sealed | null): void => {
	const ids = new Set([ownKeyId, sealed?.keyId]);
	ownKeyId = null;
	ids.forEach((id) => {
		if (typeof id === 'string' && id) dropHandoffKey(id);
	});
};

/** Ends the handoff in memory and invalidates a seal still in flight. */
const endPending = () => {
	generation++;
	const value = pending;
	pending = null;
	clearTimeout(expiry);
	expiry = undefined;
	return value;
};

export const clearLoginRecoveryPassword = (): void => {
	endPending();
	dropOwnKeys(takeSealed());
};

/** Reads the sealed entry without taking it. */
const peekSealed = (): Sealed | null => {
	try {
		const raw = sessionStorage.getItem(STORAGE_KEY);
		return raw ? (JSON.parse(raw) as Sealed) : null;
	} catch {
		return null;
	}
};

/**
 * The staging document's expiry timer dies with the navigation, while the
 * sealed entry and its key survive it. So every document re-arms the expiry
 * of a handoff it finds on load: one already past its time is dropped at
 * once, the rest when its time is up. The timer is bound to that entry's key
 * id, so it never ends a newer handoff staged later.
 */
const armSealedExpiry = (): void => {
	const sealed = peekSealed();
	if (!sealed) return;
	const endIfStill = () => {
		if (peekSealed()?.keyId === sealed.keyId) clearLoginRecoveryPassword();
	};
	const left =
		typeof sealed.expiresAt === 'number'
			? sealed.expiresAt - Date.now()
			: 0;
	if (left <= 0) {
		endIfStill();
		return;
	}
	setTimeout(endIfStill, left);
};
armSealedExpiry();

const seal = async (
	keyId: string,
	userId: string,
	password: string,
	expiresAt: number,
	stamp: number
): Promise<void> => {
	const key = await crypto.subtle.generateKey(
		{ name: 'AES-GCM', length: 256 },
		false,
		['encrypt', 'decrypt']
	);
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const data = await crypto.subtle.encrypt(
		{
			name: 'AES-GCM',
			iv,
			additionalData: new TextEncoder().encode(userId)
		},
		key,
		new TextEncoder().encode(password)
	);
	if (stamp !== generation) return;
	await putHandoffKey(keyId, key, expiresAt);
	// A clear or consume that ran during the put queued its drop before it.
	if (stamp !== generation) {
		dropHandoffKey(keyId);
		return;
	}
	const sealed: Sealed = {
		keyId,
		userId,
		expiresAt,
		iv: toBase64(iv),
		data: toBase64(data)
	};
	sessionStorage.setItem(STORAGE_KEY, JSON.stringify(sealed));
};

export const stageLoginRecoveryPassword = async (
	matrixUserId: string,
	password: string
): Promise<void> => {
	clearLoginRecoveryPassword();
	if (!matrixUserId || !password) return;
	const stamp = generation;
	const expiresAt = Date.now() + TTL_MS;
	pending = { userId: matrixUserId, password, expiresAt };
	expiry = setTimeout(clearLoginRecoveryPassword, TTL_MS);
	const keyId = newKeyId();
	ownKeyId = keyId;
	try {
		await seal(keyId, matrixUserId, password, expiresAt, stamp);
	} catch {
		// Without a sealed copy only a same-document handover can recover; the
		// app then asks for the password, as it would without any handoff. The
		// key is this seal's own; the rest only while no newer call took over.
		dropHandoffKey(keyId);
		if (stamp !== generation) return;
		if (ownKeyId === keyId) ownKeyId = null;
		takeSealed();
	}
};

const unseal = async (
	sealed: Sealed,
	matrixUserId: string
): Promise<string | null> => {
	if (typeof sealed.keyId !== 'string' || !sealed.keyId) return null;
	const key = await takeHandoffKey(sealed.keyId);
	if (
		!key ||
		sealed.userId !== matrixUserId ||
		sealed.expiresAt <= Date.now()
	)
		return null;
	const plain = await crypto.subtle.decrypt(
		{
			name: 'AES-GCM',
			iv: fromBase64(sealed.iv),
			additionalData: new TextEncoder().encode(matrixUserId)
		},
		key,
		fromBase64(sealed.data)
	);
	return new TextDecoder().decode(plain);
};

export const consumeLoginRecoveryPassword = async (
	matrixUserId: string
): Promise<string | null> => {
	const value = endPending();
	const sealed = takeSealed();
	if (value || !sealed) {
		dropOwnKeys(sealed);
		return value?.userId === matrixUserId && value.expiresAt > Date.now()
			? value.password
			: null;
	}
	try {
		return await unseal(sealed, matrixUserId);
	} catch {
		return null;
	} finally {
		dropOwnKeys(sealed);
	}
};
