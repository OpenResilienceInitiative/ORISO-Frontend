import { useSyncExternalStore } from 'react';
const listeners = new Set<() => void>();
export const notifyRecoveryState = (): void =>
	listeners.forEach((listener) => listener());
export const subscribeRecoveryState = (listener: () => void): (() => void) => {
	listeners.add(listener);
	const onStorage = (event: StorageEvent) => {
		if (
			event.key?.startsWith('oriso.pendingRecoveryKey.') ||
			event.key?.startsWith('oriso.recoveryReminder.')
		)
			listener();
	};
	if (typeof window !== 'undefined')
		window.addEventListener('storage', onStorage);
	return () => {
		listeners.delete(listener);
		if (typeof window !== 'undefined')
			window.removeEventListener('storage', onStorage);
	};
};
const prefix = 'oriso.recoveryReminder.';
const read = (userId: string): { dismissed?: boolean; sessionId?: number } => {
	try {
		const value: unknown = JSON.parse(
			sessionStorage.getItem(prefix + userId) ?? '{}'
		);
		if (!value || typeof value !== 'object' || Array.isArray(value))
			return {};
		const state = value as { dismissed?: unknown; sessionId?: unknown };
		if (
			(state.dismissed !== undefined &&
				typeof state.dismissed !== 'boolean') ||
			(state.sessionId !== undefined &&
				!Number.isSafeInteger(state.sessionId))
		)
			return {};
		return state as { dismissed?: boolean; sessionId?: number };
	} catch {
		return {};
	}
};
const write = (userId: string, value: ReturnType<typeof read>) => {
	try {
		sessionStorage.setItem(prefix + userId, JSON.stringify(value));
	} catch {
		/* optional invitation */
	}
	notifyRecoveryState();
};
export const markEnquiryFinalized = (
	matrixUserId: string,
	sessionId: number
): void => {
	if (!matrixUserId || !Number.isSafeInteger(sessionId)) return;
	const state = read(matrixUserId);
	if (state.dismissed || state.sessionId !== undefined) return;
	write(matrixUserId, { sessionId });
};
export const dismissRecoveryReminder = (matrixUserId: string): void =>
	write(matrixUserId, { ...read(matrixUserId), dismissed: true });
export const isRecoveryReminderEligible = (matrixUserId: string): boolean => {
	const state = read(matrixUserId);
	return state.sessionId !== undefined && !state.dismissed;
};
export const useRecoveryReminder = (userId: string): boolean =>
	useSyncExternalStore(
		subscribeRecoveryState,
		() => isRecoveryReminderEligible(userId),
		() => false
	);
export type RecoveryRuntimeStatus =
	| 'idle'
	| 'pending'
	| 'busy'
	| 'device-ready'
	| 'ready'
	| 'needs-password'
	| 'needs-recovery-key'
	| 'retryable-failure';
const statuses = new Map<string, RecoveryRuntimeStatus>();
export const setRecoveryRuntimeStatus = (
	userId: string,
	status: RecoveryRuntimeStatus
): void => {
	statuses.set(userId, status);
	notifyRecoveryState();
};
export const clearRecoveryRuntimeState = (): void => {
	statuses.clear();
	notifyRecoveryState();
};
export const useRecoveryRuntimeStatus = (
	userId: string
): RecoveryRuntimeStatus =>
	useSyncExternalStore(
		subscribeRecoveryState,
		() => statuses.get(userId) ?? 'idle',
		() => 'idle'
	);

export const isActionableRecoveryStatus = (
	status: RecoveryRuntimeStatus
): boolean =>
	['needs-password', 'needs-recovery-key', 'retryable-failure'].includes(
		status
	);
