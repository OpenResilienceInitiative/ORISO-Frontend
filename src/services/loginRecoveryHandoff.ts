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

type Sealed = { userId: string; expiresAt: number; iv: string; data: string };

const toBase64 = (bytes: ArrayBuffer | Uint8Array) =>
	btoa(String.fromCharCode(...new Uint8Array(bytes)));
const fromBase64 = (text: string) =>
	Uint8Array.from(atob(text), (char) => char.charCodeAt(0));

const dropSealed = (): void => {
	try {
		sessionStorage.removeItem(STORAGE_KEY);
	} catch {
		// Storage can be unavailable (private mode, blocked site data).
	}
	dropHandoffKey();
};

/** Takes the sealed entry off session storage, so a second reader finds nothing. */
const takeSealed = (): Sealed | null => {
	try {
		const raw = sessionStorage.getItem(STORAGE_KEY);
		sessionStorage.removeItem(STORAGE_KEY);
		return raw ? (JSON.parse(raw) as Sealed) : null;
	} catch {
		return null;
	}
};

export const clearLoginRecoveryPassword = (): void => {
	pending = null;
	clearTimeout(expiry);
	expiry = undefined;
	dropSealed();
};

const seal = async (
	userId: string,
	password: string,
	expiresAt: number
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
	await putHandoffKey(key);
	const sealed: Sealed = {
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
	const expiresAt = Date.now() + TTL_MS;
	pending = { userId: matrixUserId, password, expiresAt };
	expiry = setTimeout(clearLoginRecoveryPassword, TTL_MS);
	try {
		await seal(matrixUserId, password, expiresAt);
	} catch {
		// Without a sealed copy only a same-document handover can recover; the
		// app then asks for the password, as it would without any handoff.
		dropSealed();
	}
};

const unseal = async (
	sealed: Sealed,
	matrixUserId: string
): Promise<string | null> => {
	const key = await takeHandoffKey();
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
	const value = pending;
	pending = null;
	clearTimeout(expiry);
	expiry = undefined;
	const sealed = takeSealed();
	if (value) {
		dropHandoffKey();
		return value.userId === matrixUserId && value.expiresAt > Date.now()
			? value.password
			: null;
	}
	if (!sealed) {
		dropHandoffKey();
		return null;
	}
	try {
		return await unseal(sealed, matrixUserId);
	} catch {
		return null;
	} finally {
		dropHandoffKey();
	}
};
