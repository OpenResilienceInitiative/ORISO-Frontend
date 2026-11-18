import { apiKeepTemporaryAccount } from '../../api/apiKeepTemporaryAccount';
import { getChatRecoveryPolicy } from '../../services/chatRecoveryPolicy';
import { getMatrixClientService } from '../../services/matrixClientRegistry';
import { sealRecoveryKeyUnderPassword } from '../../services/passwordRecoveryEnrollment';
import { loadPendingRecoveryKey } from '../../services/pendingRecoveryKeyStore';

/**
 * `kept`: the account stays, and the chat history opens on a new device the
 * usual way. `recoveryPending`: the account stays, but the login password
 * does not unlock the chat history yet (see below).
 */
export type KeepTemporaryAccountResult = 'kept' | 'recoveryPending';

/**
 * UserService#1662: keep a temporary account under a password the guest
 * chooses, then move the chat recovery to that password.
 *
 * With the LOGIN_PASSWORD recovery mode the key backup is sealed under the
 * login password. The temporary account's password was generated at entry
 * and is gone after the first sync, so its envelope cannot be re-wrapped
 * from old to new password. What can be done: seal the recovery key still
 * parked on this device (it stays for seven days after it was protected)
 * under the new password. Without a parked key, or without a ready chat,
 * the account is kept and the person is told they need their recovery key.
 *
 * Rejects only when the server refuses the keep; the recovery is then left
 * alone.
 */
export const keepTemporaryAccount = async (
	password: string,
	account: {
		chatRecoveryMode?: string | null;
		chatRecoveryPolicyRevision?: number | null;
	}
): Promise<KeepTemporaryAccountResult> => {
	await apiKeepTemporaryAccount(password);
	const policy = getChatRecoveryPolicy(account);
	if (policy.mode !== 'LOGIN_PASSWORD') return 'kept';
	try {
		const client = await getMatrixClientService()?.getReadyClient();
		const userId = client?.getUserId();
		if (!client || !userId) return 'recoveryPending';
		const parkedKey = await loadPendingRecoveryKey(userId);
		if (!parkedKey) return 'recoveryPending';
		await sealRecoveryKeyUnderPassword(
			client,
			userId,
			password,
			parkedKey,
			policy.revision
		);
		return 'kept';
	} catch {
		return 'recoveryPending';
	}
};
