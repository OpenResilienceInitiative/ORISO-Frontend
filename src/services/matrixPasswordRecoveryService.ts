import {
	readRecoveryAccountData,
	readRecoveryRoot,
	serverBackedSecretStorage
} from './matrixRecoveryAccountData';
import { Method, type MatrixClient } from 'matrix-js-sdk';
import {
	SECRET_STORAGE_ALGORITHM_V1_AES,
	type SecretStorageKeyDescriptionAesV1
} from 'matrix-js-sdk/lib/secret-storage';
import { deriveRecoveryKeyFromPassphrase } from 'matrix-js-sdk/lib/crypto-api/key-passphrase';
import {
	recoverWithKey,
	validateRecoveryKey,
	withSecretStorageKeys,
	secretStorageKeyCallback
} from './matrixKeyBackupService';

export const PASSWORD_RECOVERY_SECRET = 'org.oriso.password_recovery.v1';
export const PASSWORD_RECOVERY_CANDIDATE_PREFIX =
	'org.oriso.password_recovery_candidate.v1.';
export const PASSWORD_RECOVERY_METADATA =
	'org.oriso.password_recovery_metadata.v1';
type Payload = {
	schemaVersion: 1;
	matrixUserId: string;
	recoveryKey: string;
	predecessorKeyIds?: string[];
	replacesLegacyEnvelope?: boolean;
	policyRevision?: number;
};
type Metadata = {
	schemaVersion: 1;
	passwordKeyId: string;
	pendingPasswordKeyId?: string;
	policyRevision: number;
};
declare module 'matrix-js-sdk/lib/@types/event' {
	interface SecretStorageAccountDataEvents {
		[type: `org.oriso.password_recovery_candidate.v1.${string}`]: {
			encrypted: Record<string, unknown>;
		};

		'org.oriso.password_recovery.v1': {
			encrypted: Record<string, unknown>;
		};
	}
	interface AccountDataEvents {
		'org.oriso.password_recovery_metadata.v1': Metadata;
	}
}
export type PasswordRecoveryStatus = {
	kind: 'ready' | 'not-enrolled' | 'needs-recovery-key' | 'retryable-failure';
};
class EnvelopeUnavailable extends Error {}
/** The given password opens none of the password-sealed copies of the recovery key. */
export class PasswordRecoveryPasswordRejectedError extends Error {}
const PasswordRejected = PasswordRecoveryPasswordRejectedError;
export class PasswordRecoveryRepairBlockedError extends Error {}
export class PasswordRecoveryRepairRequiredError extends Error {}
export class PasswordRecoveryWorkLimitError extends Error {}

// SDK 38.4 creates 256-bit PBKDF2-SHA512 wrappers with 500,000 iterations.
// Bound work before invoking the SDK; a deadline cannot cancel an active KDF.
const SDK_DERIVATION_ITERATIONS = 500000;
const MAX_DERIVATION_ITERATIONS = 1000000;
class DerivationBudget {
	private remaining = 4000000;
	consume(iterations: number) {
		if (
			iterations > MAX_DERIVATION_ITERATIONS ||
			iterations > this.remaining
		)
			throw new PasswordRecoveryWorkLimitError();
		this.remaining -= iterations;
	}
}

const readMetadata = async (client: MatrixClient): Promise<Metadata | null> => {
	const raw = (await readRecoveryAccountData(
		client,
		PASSWORD_RECOVERY_METADATA
	)) as Partial<Metadata> | null;
	if (!raw) return null;
	if (
		raw.schemaVersion !== 1 ||
		typeof raw.passwordKeyId !== 'string' ||
		!raw.passwordKeyId ||
		(raw.pendingPasswordKeyId !== undefined &&
			(typeof raw.pendingPasswordKeyId !== 'string' ||
				!raw.pendingPasswordKeyId)) ||
		!Number.isSafeInteger(raw.policyRevision) ||
		raw.policyRevision! < 0
	)
		throw new EnvelopeUnavailable();
	return raw as Metadata;
};
const writeMetadata = async (client: MatrixClient, metadata: Metadata) => {
	await client.setAccountData(PASSWORD_RECOVERY_METADATA, metadata);
	if (JSON.stringify(await readMetadata(client)) !== JSON.stringify(metadata))
		throw new EnvelopeUnavailable();
};
const fingerprint = async (
	client: MatrixClient,
	repairRequired = false
): Promise<string> => {
	const root = await readRecoveryRoot(client);
	const crypto = client.getCrypto();
	// The SDK caches "no backup" from its first check after start; a backup
	// created later (another tab or device) would read as missing. Ask the
	// server again before calling the recovery incomplete.
	const backup =
		(await crypto?.getKeyBackupInfo()) ??
		(await crypto?.checkKeyBackupAndEnable?.())?.backupInfo ??
		null;
	if (!root || !backup) {
		if (repairRequired) throw new PasswordRecoveryRepairRequiredError();
		throw new EnvelopeUnavailable();
	}
	return JSON.stringify([root, backup.version, backup.auth_data]);
};
const assertUnchanged = async (client: MatrixClient, expected: string) => {
	if ((await fingerprint(client)) !== expected)
		throw new EnvelopeUnavailable();
};
const readPayload = async (
	client: MatrixClient,
	id: string,
	key: Uint8Array,
	secretName: keyof import('matrix-js-sdk/lib/@types/event').SecretStorageAccountDataEvents = PASSWORD_RECOVERY_SECRET
): Promise<Payload> => {
	const raw = await withSecretStorageKeys(client, new Map([[id, key]]), () =>
		serverBackedSecretStorage(client, {
			getSecretStorageKey: (keys, name) =>
				secretStorageKeyCallback(client, keys, name)
		}).get(secretName)
	);
	let payload: Payload;
	try {
		payload = JSON.parse(raw ?? 'null');
	} catch {
		throw new PasswordRejected();
	}
	if (
		payload?.schemaVersion !== 1 ||
		payload.matrixUserId !== client.getUserId() ||
		typeof payload.recoveryKey !== 'string'
	)
		throw new PasswordRejected();
	await validateRecoveryKey(client, payload.recoveryKey);
	return payload;
};
const unlock = async (
	client: MatrixClient,
	password: string,
	metadata: Metadata,
	budget: DerivationBudget
) => {
	for (const id of [
		metadata.pendingPasswordKeyId,
		metadata.passwordKeyId
	].filter(Boolean) as string[]) {
		const info =
			await readRecoveryAccountData<SecretStorageKeyDescriptionAesV1>(
				client,
				`m.secret_storage.key.${id}`
			);
		const passphrase = info?.passphrase;
		if (
			info?.algorithm !== SECRET_STORAGE_ALGORITHM_V1_AES ||
			passphrase?.algorithm !== 'm.pbkdf2' ||
			typeof passphrase.salt !== 'string' ||
			!Number.isSafeInteger(passphrase.iterations) ||
			passphrase.iterations < 1 ||
			(passphrase.bits !== undefined && passphrase.bits !== 256)
		)
			throw new EnvelopeUnavailable();
		budget.consume(passphrase.iterations);
		const key = await deriveRecoveryKeyFromPassphrase(
			password,
			passphrase.salt,
			passphrase.iterations,
			passphrase.bits
		);
		if (!(await client.secretStorage.checkKey(key, info))) continue;
		return { id, key, payload: await readPayload(client, id, key) };
	}
	throw new PasswordRejected();
};
const storePayload = (
	client: MatrixClient,
	payload: Payload,
	keys: Map<string, Uint8Array>,
	secretName: keyof import('matrix-js-sdk/lib/@types/event').SecretStorageAccountDataEvents = PASSWORD_RECOVERY_SECRET
) =>
	withSecretStorageKeys(client, keys, () =>
		client.secretStorage.store(secretName, JSON.stringify(payload), [
			...keys.keys()
		])
	);
const addPasswordKey = async (
	client: MatrixClient,
	password: string,
	budget: DerivationBudget
) => {
	budget.consume(SDK_DERIVATION_ITERATIONS);
	const generated = await client
		.getCrypto()
		?.createRecoveryKeyFromPassphrase(password);
	if (
		!generated ||
		generated.keyInfo?.passphrase?.iterations !==
			SDK_DERIVATION_ITERATIONS ||
		generated.keyInfo.passphrase.algorithm !== 'm.pbkdf2' ||
		(generated.keyInfo.passphrase.bits !== undefined &&
			generated.keyInfo.passphrase.bits !== 256)
	)
		throw new EnvelopeUnavailable();
	const { keyId } = await client.secretStorage.addKey(
		SECRET_STORAGE_ALGORITHM_V1_AES,
		{ ...generated.keyInfo, key: generated.privateKey }
	);
	return { id: keyId, key: generated.privateKey };
};

/** Envelope/metadata presence is evidence of enrollment even during a failed write. */
export const hasPasswordRecoveryEvidence = async (
	client: MatrixClient
): Promise<boolean> => {
	const [metadata, secret] = await Promise.all([
		readRecoveryAccountData(client, PASSWORD_RECOVERY_METADATA),
		readRecoveryAccountData(client, PASSWORD_RECOVERY_SECRET)
	]);
	return (
		metadata != null ||
		secret != null ||
		(await candidateIds(client)).length > 0
	);
};
/**
 * Secret storage and the server key backup both exist, so a recovery key the
 * person still holds can be sealed under a password. Without them there is
 * no key to ask for; the next password sign-in sets recovery up instead.
 */
export const hasCompleteKeyRecovery = async (
	client: MatrixClient
): Promise<boolean> => {
	try {
		await fingerprint(client);
		return true;
	} catch {
		return false;
	}
};
const writePasswordEnvelope = async (
	client: MatrixClient,
	password: string,
	encodedRecoveryKey: string,
	policyRevision: number
): Promise<void> => {
	const budget = new DerivationBudget();
	if (
		!password ||
		!Number.isSafeInteger(policyRevision) ||
		policyRevision < 0
	)
		throw new EnvelopeUnavailable();
	if (await hasPasswordRecoveryEvidence(client))
		throw new EnvelopeUnavailable();
	const enrollmentSnapshot = JSON.stringify(
		await Promise.all([
			readRecoveryAccountData(client, PASSWORD_RECOVERY_METADATA),
			readRecoveryAccountData(client, PASSWORD_RECOVERY_SECRET)
		])
	);
	await validateRecoveryKey(client, encodedRecoveryKey);
	const identity = await fingerprint(client);
	const payload: Payload = {
		schemaVersion: 1,
		matrixUserId: client.getUserId()!,
		recoveryKey: encodedRecoveryKey
	};
	const wrapping = await addPasswordKey(client, password, budget);
	await assertUnchanged(client, identity);
	if (await hasPasswordRecoveryEvidence(client))
		throw new EnvelopeUnavailable();
	if (
		JSON.stringify(
			await Promise.all([
				readRecoveryAccountData(client, PASSWORD_RECOVERY_METADATA),
				readRecoveryAccountData(client, PASSWORD_RECOVERY_SECRET)
			])
		) !== enrollmentSnapshot
	)
		throw new EnvelopeUnavailable();
	await storePayload(client, payload, new Map([[wrapping.id, wrapping.key]]));
	await readPayload(client, wrapping.id, wrapping.key);
	await assertUnchanged(client, identity);
	await writeMetadata(client, {
		schemaVersion: 1,
		passwordKeyId: wrapping.id,
		policyRevision
	});
	// Verify via a newly derived key and the real restore path, not merely a write ACK.
	if (
		(await recoverWithPasswordBudget(client, password, budget)).kind !==
		'ready'
	)
		throw new EnvelopeUnavailable();
};

export const enrollPasswordRecovery = (
	client: MatrixClient,
	password: string,
	encodedRecoveryKey: string,
	policyRevision: number
): Promise<void> =>
	writePasswordEnvelope(client, password, encodedRecoveryKey, policyRevision);

/** Explicit repair after the authenticated user supplies their unchanged recovery key. */

export const enrollPasswordRecoveryAfterKeyRecovery = async (
	client: MatrixClient,
	password: string,
	encodedRecoveryKey: string,
	policyRevision: number
): Promise<void> => {
	const budget = new DerivationBudget();
	if (
		!password ||
		!Number.isSafeInteger(policyRevision) ||
		policyRevision < 0
	)
		throw new EnvelopeUnavailable();
	await readMetadata(client);
	// Proves the key: only after this may stale copies be replaced.
	await recoverWithKey(client, encodedRecoveryKey);
	const identity = await fingerprint(client);
	const predecessors: string[] = [];
	for (const id of await candidateIds(client)) {
		/* A candidate not sealed under its own wrapping key is a partial or
		   foreign write: nothing proves what it holds, so it blocks. */
		if (!(await isSealedUnderOwnKey(client, id)))
			throw new PasswordRecoveryRepairBlockedError();
		const existing = await unlockCandidate(client, password, id, budget);
		/* A well-formed copy the current password does not open is stale —
		   sealed under a password changed outside this app (#1931). The
		   recovery key it would hold is the one just proven, so the fresh
		   copy replaces it once that copy is verified. */
		predecessors.push(id, ...(existing?.payload.predecessorKeyIds ?? []));
	}
	const next = await addPasswordKey(client, password, budget);
	const payload: Payload = {
		schemaVersion: 1,
		matrixUserId: client.getUserId()!,
		recoveryKey: encodedRecoveryKey,
		policyRevision,
		predecessorKeyIds: [...new Set(predecessors)],
		replacesLegacyEnvelope: true
	};
	await assertUnchanged(client, identity);
	await storePayload(
		client,
		payload,
		new Map([[next.id, next.key]]),
		candidateName(next.id)
	);
	const candidate = await unlockCandidate(client, password, next.id, budget);
	if (!candidate) throw new EnvelopeUnavailable();
	await assertUnchanged(client, identity);
	try {
		await retirePredecessors(client, candidate);
	} catch {
		/* candidate remains independently recoverable */
	}
};

const candidateName = (
	id: string
): `org.oriso.password_recovery_candidate.v1.${string}` =>
	`${PASSWORD_RECOVERY_CANDIDATE_PREFIX}${id}`;
const candidateIds = async (client: MatrixClient): Promise<string[]> => {
	// Independent complete account-data inventory. Never feed its next_batch
	// into the primary client: this request must not acknowledge to-device data.
	const response = await client.http.authedRequest<{
		next_batch?: string;
		account_data?: {
			events?: {
				type: string;
				content: { encrypted?: Record<string, unknown> };
			}[];
		};
	}>(
		Method.Get,
		'/sync',
		{
			timeout: 0,
			filter: JSON.stringify({
				room: { rooms: [] },
				presence: { types: [] },
				account_data: {
					types: [`${PASSWORD_RECOVERY_CANDIDATE_PREFIX}*`]
				}
			})
		},
		undefined,
		{ localTimeoutMs: 15000, priority: 'high' }
	);
	if (!response || typeof response.next_batch !== 'string')
		throw new EnvelopeUnavailable();
	const events = response.account_data?.events ?? [];
	if (!Array.isArray(events)) throw new EnvelopeUnavailable();
	const ids = events
		.filter(
			(event) =>
				typeof event.type === 'string' &&
				event.type.startsWith(PASSWORD_RECOVERY_CANDIDATE_PREFIX) &&
				event.content?.encrypted
		)
		.map((event) =>
			event.type.slice(PASSWORD_RECOVERY_CANDIDATE_PREFIX.length)
		);
	if (ids.some((id) => !id) || ids.length > 64)
		throw new EnvelopeUnavailable();
	return [...new Set(ids)];
};
const isSealedUnderOwnKey = async (client: MatrixClient, id: string) =>
	!!(
		await readRecoveryAccountData<{
			encrypted?: Record<string, unknown>;
		}>(client, candidateName(id))
	)?.encrypted?.[id];
const unlockCandidate = async (
	client: MatrixClient,
	password: string,
	id: string,
	budget: DerivationBudget
) => {
	const evidence = await readRecoveryAccountData<{
		encrypted?: Record<string, unknown>;
	}>(client, candidateName(id));
	if (!evidence?.encrypted?.[id]) return null;
	const info =
		await readRecoveryAccountData<SecretStorageKeyDescriptionAesV1>(
			client,
			`m.secret_storage.key.${id}`
		);
	const params = info?.passphrase;
	if (
		info?.algorithm !== SECRET_STORAGE_ALGORITHM_V1_AES ||
		params?.algorithm !== 'm.pbkdf2' ||
		typeof params.salt !== 'string' ||
		!Number.isSafeInteger(params.iterations) ||
		params.iterations < 1 ||
		(params.bits !== undefined && params.bits !== 256)
	)
		throw new EnvelopeUnavailable();
	budget.consume(params.iterations);
	const key = await deriveRecoveryKeyFromPassphrase(
		password,
		params.salt,
		params.iterations,
		params.bits
	);
	if (!(await client.secretStorage.checkKey(key, info))) return null;
	const payload = await readPayload(client, id, key, candidateName(id));
	if (
		!Array.isArray(payload.predecessorKeyIds) ||
		payload.predecessorKeyIds.some(
			(value) => typeof value !== 'string' || !value || value === id
		) ||
		typeof payload.replacesLegacyEnvelope !== 'boolean' ||
		!Number.isSafeInteger(payload.policyRevision) ||
		payload.policyRevision! < 0
	)
		throw new EnvelopeUnavailable();
	return { id, key, payload };
};
const retirePredecessors = async (
	client: MatrixClient,
	candidate: NonNullable<Awaited<ReturnType<typeof unlockCandidate>>>
) => {
	// Only immutable predecessors captured before the credential change. A
	// delayed successful response can never overwrite a newer password wrapper.
	await readPayload(
		client,
		candidate.id,
		candidate.key,
		candidateName(candidate.id)
	);
	for (const id of candidate.payload.predecessorKeyIds!) {
		await client.setAccountData(
			candidateName(
				id
			) as `org.oriso.password_recovery_candidate.v1.${string}`,
			{}
		);
	}
	if (candidate.payload.replacesLegacyEnvelope)
		await client.setAccountData(PASSWORD_RECOVERY_SECRET, {});
};

const discardCandidate = async (client: MatrixClient, id: string) => {
	try {
		await client.setAccountData(candidateName(id), {});
	} catch {
		/* retain own candidate if cleanup cannot be confirmed */
	}
};

/** Call only after successful online authentication, including required OTP. */
export const recoverWithLoginPassword = async (
	client: MatrixClient,
	password: string
): Promise<PasswordRecoveryStatus> =>
	recoverWithPasswordBudget(client, password, new DerivationBudget());

const recoverWithPasswordBudget = async (
	client: MatrixClient,
	password: string,
	budget: DerivationBudget
): Promise<PasswordRecoveryStatus> => {
	try {
		const metadata = await readMetadata(client);
		const ids = await candidateIds(client);
		for (const id of ids) {
			const candidate = await unlockCandidate(
				client,
				password,
				id,
				budget
			);
			if (!candidate) continue;
			await recoverWithKey(client, candidate.payload.recoveryKey);
			try {
				await retirePredecessors(client, candidate);
			} catch {
				/* durable candidate still provides recovery */
			}
			return { kind: 'ready' };
		}
		const legacy = await readRecoveryAccountData<{ encrypted?: unknown }>(
			client,
			PASSWORD_RECOVERY_SECRET
		);
		if (!metadata) {
			/* Candidates alone are a complete enrolment (sealed with the
			   recovery key, #1917); none opening means the password changed
			   since. A legacy envelope without metadata is an interrupted
			   first write instead. */
			if (ids.length && !legacy?.encrypted)
				return { kind: 'needs-recovery-key' };
			return {
				kind:
					ids.length || (await hasPasswordRecoveryEvidence(client))
						? 'retryable-failure'
						: 'not-enrolled'
			};
		}
		if (!legacy?.encrypted) return { kind: 'needs-recovery-key' };
		const unlocked = await unlock(client, password, metadata, budget);
		await recoverWithKey(client, unlocked.payload.recoveryKey);
		return { kind: 'ready' };
	} catch (error) {
		return {
			kind:
				error instanceof PasswordRejected
					? 'needs-recovery-key'
					: 'retryable-failure'
		};
	}
};

type StagedCandidate = NonNullable<Awaited<ReturnType<typeof unlockCandidate>>>;

/**
 * Re-wrap the recovery key from `oldPassword` to `newPassword`: open whichever password-sealed
 * copy the old password opens, stage a separately addressed candidate under the new one and verify
 * it. The predecessors are retired by the caller, once the new password is the account's.
 * Staging never replaces another device's candidate or the shared envelope.
 */
const stagePasswordRewrap = async (
	client: MatrixClient,
	oldPassword: string,
	newPassword: string,
	budget: DerivationBudget
): Promise<StagedCandidate> => {
	const metadata = await readMetadata(client);
	const identity = await fingerprint(client, true);
	const predecessors: string[] = [];
	let payload: Payload | undefined;
	const ids = await candidateIds(client);
	for (const id of ids) {
		const candidate = await unlockCandidate(
			client,
			oldPassword,
			id,
			budget
		);
		if (candidate) {
			predecessors.push(id, ...candidate.payload.predecessorKeyIds!);
			payload = candidate.payload;
		}
	}
	let replacesLegacyEnvelope = payload?.replacesLegacyEnvelope ?? false;
	const legacy = await readRecoveryAccountData<{ encrypted?: unknown }>(
		client,
		PASSWORD_RECOVERY_SECRET
	);
	const hasLegacyEnvelope =
		legacy?.encrypted != null &&
		typeof legacy.encrypted === 'object' &&
		Object.keys(legacy.encrypted).length > 0;
	if (hasLegacyEnvelope && metadata) {
		try {
			payload = (await unlock(client, oldPassword, metadata, budget))
				.payload;
			replacesLegacyEnvelope = true;
		} catch (error) {
			if (!(error instanceof PasswordRejected)) throw error;
		}
	}
	if (!payload) {
		if (!ids.length && (!hasLegacyEnvelope || !metadata))
			throw new PasswordRecoveryRepairRequiredError();
		throw new PasswordRejected();
	}
	const next = await addPasswordKey(client, newPassword, budget);
	const nextPayload: Payload = {
		schemaVersion: 1,
		matrixUserId: payload.matrixUserId,
		recoveryKey: payload.recoveryKey,
		predecessorKeyIds: [...new Set(predecessors)],
		replacesLegacyEnvelope,
		policyRevision: metadata?.policyRevision ?? payload.policyRevision
	};
	await assertUnchanged(client, identity);
	try {
		await storePayload(
			client,
			nextPayload,
			new Map([[next.id, next.key]]),
			candidateName(next.id)
		);
		const candidate = await unlockCandidate(
			client,
			newPassword,
			next.id,
			budget
		);
		if (!candidate) throw new EnvelopeUnavailable();
		await assertUnchanged(client, identity);
		return candidate;
	} catch (error) {
		await discardCandidate(client, next.id);
		throw error;
	}
};

export const changePasswordWithRecovery = async (
	client: MatrixClient,
	oldPassword: string,
	newPassword: string,
	updatePassword: () => Promise<unknown>,
	isDefiniteFailure: (error: unknown) => boolean = () => false
): Promise<void> => {
	const staged = await stagePasswordRewrap(
		client,
		oldPassword,
		newPassword,
		new DerivationBudget()
	);
	try {
		await updatePassword();
	} catch (error) {
		if (isDefiniteFailure(error)) await discardCandidate(client, staged.id);
		throw error;
	}
	try {
		await retirePredecessors(client, staged);
	} catch {
		/* candidate is independently discoverable */
	}
};

/**
 * The password was changed outside this app (Admin "Mein Konto", forgot-password, a setup link):
 * the account already has `currentPassword`, but the recovery key is still sealed under
 * `previousPassword`. Re-wrap it to the current password exactly as an in-app change would, retire
 * the old copies, and unlock the history on this device (#1931).
 *
 * Call only after `currentPassword` was proven (re-authentication including a required OTP).
 * Rejects with {@link PasswordRecoveryPasswordRejectedError} when the previous password opens
 * nothing; then nothing has changed.
 */
export const resealWithPreviousPassword = async (
	client: MatrixClient,
	previousPassword: string,
	currentPassword: string
): Promise<void> => {
	if (!previousPassword || !currentPassword) throw new PasswordRejected();
	const staged = await stagePasswordRewrap(
		client,
		previousPassword,
		currentPassword,
		new DerivationBudget()
	);
	try {
		await retirePredecessors(client, staged);
	} catch {
		/* candidate is independently discoverable */
	}
	await recoverWithKey(client, staged.payload.recoveryKey);
};
