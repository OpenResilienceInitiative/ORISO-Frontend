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
/* Counts status changes, so a pass through another status (e.g. 'pending') is visible even when
   React renders only the end state of one batch. */
const revisions = new Map<string, number>();
export const setRecoveryRuntimeStatus = (
	userId: string,
	status: RecoveryRuntimeStatus
): void => {
	if (statuses.get(userId) !== status) {
		revisions.set(userId, (revisions.get(userId) ?? 0) + 1);
	}
	statuses.set(userId, status);
	notifyRecoveryState();
};
export const useRecoveryRuntimeRevision = (userId: string): number =>
	useSyncExternalStore(
		subscribeRecoveryState,
		() => revisions.get(userId) ?? 0,
		() => 0
	);
/** The current status, for callers outside React that must not overwrite a
 *  more specific one they did not produce. */
export const getRecoveryRuntimeStatus = (
	userId: string
): RecoveryRuntimeStatus => statuses.get(userId) ?? 'idle';
export const clearRecoveryRuntimeState = (): void => {
	statuses.clear();
	revisions.clear();
	notifyRecoveryState();
};
export const useRecoveryRuntimeStatus = (
	userId: string
): RecoveryRuntimeStatus =>
	useSyncExternalStore(
		subscribeRecoveryState,
		() => getRecoveryRuntimeStatus(userId),
		() => 'idle'
	);

export const isActionableRecoveryStatus = (
	status: RecoveryRuntimeStatus
): boolean =>
	['needs-password', 'needs-recovery-key', 'retryable-failure'].includes(
		status
	);
