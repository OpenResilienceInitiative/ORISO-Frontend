/** One-use, memory-only credential handoff after complete authentication. */
let pending: { userId: string; password: string; expiresAt: number } | null =
	null;
let expiry: ReturnType<typeof setTimeout> | undefined;
export const clearLoginRecoveryPassword = (): void => {
	pending = null;
	clearTimeout(expiry);
	expiry = undefined;
};
export const stageLoginRecoveryPassword = (
	matrixUserId: string,
	password: string
): void => {
	clearLoginRecoveryPassword();
	if (!matrixUserId || !password) return;
	pending = {
		userId: matrixUserId,
		password,
		expiresAt: Date.now() + 120000
	};
	expiry = setTimeout(clearLoginRecoveryPassword, 120000);
};
export const consumeLoginRecoveryPassword = (
	matrixUserId: string
): string | null => {
	const value = pending;
	clearLoginRecoveryPassword();
	return value?.userId === matrixUserId && value.expiresAt > Date.now()
		? value.password
		: null;
};
