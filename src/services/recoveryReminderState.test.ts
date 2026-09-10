// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
import {
	markEnquiryFinalized,
	setRecoveryRuntimeStatus,
	clearRecoveryRuntimeState,
	subscribeRecoveryState,
	dismissRecoveryReminder,
	isRecoveryReminderEligible
} from './recoveryReminderState';
beforeEach(() => {
	sessionStorage.clear();
	clearRecoveryRuntimeState();
});
it('is silent before finalization, coalesces success and survives remounts', () => {
	expect(isRecoveryReminderEligible('@a:test')).toBe(false);
	markEnquiryFinalized('@a:test', 12);
	markEnquiryFinalized('@a:test', 12);
	expect(isRecoveryReminderEligible('@a:test')).toBe(true);
	expect(isRecoveryReminderEligible('@b:test')).toBe(false);
	dismissRecoveryReminder('@a:test');
	markEnquiryFinalized('@a:test', 12);
	markEnquiryFinalized('@a:test', 13);
	expect(isRecoveryReminderEligible('@a:test')).toBe(false);
});

it('notifies on runtime changes and clearing without retaining subscribers', () => {
	const listener = vi.fn();
	const unsubscribe = subscribeRecoveryState(listener);
	setRecoveryRuntimeStatus('@a:test', 'ready');
	clearRecoveryRuntimeState();
	expect(listener).toHaveBeenCalledTimes(2);
	unsubscribe();
	setRecoveryRuntimeStatus('@a:test', 'pending');
	expect(listener).toHaveBeenCalledTimes(2);
});
it('responds to another tab parking a recovery key and removes its storage listener', () => {
	const listener = vi.fn();
	const unsubscribe = subscribeRecoveryState(listener);
	window.dispatchEvent(new StorageEvent('storage', { key: 'unrelated' }));
	expect(listener).not.toHaveBeenCalled();
	window.dispatchEvent(
		new StorageEvent('storage', { key: 'oriso.pendingRecoveryKey.@a:test' })
	);
	expect(listener).toHaveBeenCalledOnce();
	unsubscribe();
	window.dispatchEvent(
		new StorageEvent('storage', { key: 'oriso.pendingRecoveryKey.@a:test' })
	);
	expect(listener).toHaveBeenCalledOnce();
});

it.each([
	null,
	[],
	2,
	true,
	'text',
	{ sessionId: '12' },
	{ sessionId: 12, dismissed: 'false' }
])('ignores malformed stored reminder %j', (value) => {
	sessionStorage.setItem(
		'oriso.recoveryReminder.@a:test',
		JSON.stringify(value)
	);
	expect(isRecoveryReminderEligible('@a:test')).toBe(false);
	markEnquiryFinalized('@a:test', 12);
	expect(isRecoveryReminderEligible('@a:test')).toBe(true);
});
