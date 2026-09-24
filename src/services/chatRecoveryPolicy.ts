export type ChatRecoveryMode = 'RECOVERY_KEY' | 'LOGIN_PASSWORD';
export type ChatRecoveryPolicy =
	| { mode: 'RECOVERY_KEY' }
	| { mode: 'LOGIN_PASSWORD'; revision: number };
/** Only the immutable authenticated account snapshot is authoritative. */
export const getChatRecoveryPolicy = (
	account: {
		chatRecoveryMode?: string | null;
		chatRecoveryPolicyRevision?: number | null;
	},
	anonymous = false
): ChatRecoveryPolicy => {
	if (
		anonymous ||
		account.chatRecoveryMode == null ||
		account.chatRecoveryMode === 'RECOVERY_KEY'
	)
		return { mode: 'RECOVERY_KEY' };
	if (
		account.chatRecoveryMode !== 'LOGIN_PASSWORD' ||
		!Number.isSafeInteger(account.chatRecoveryPolicyRevision) ||
		account.chatRecoveryPolicyRevision! < 0
	)
		throw new Error('Invalid chat recovery policy');
	return {
		mode: 'LOGIN_PASSWORD',
		revision: account.chatRecoveryPolicyRevision!
	};
};
