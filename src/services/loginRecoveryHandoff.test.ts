import { afterEach, expect, it, vi } from 'vitest';
import {
	stageLoginRecoveryPassword,
	consumeLoginRecoveryPassword,
	clearLoginRecoveryPassword
} from './loginRecoveryHandoff';
afterEach(() => {
	clearLoginRecoveryPassword();
	vi.useRealTimers();
});
it('hands the password to only its authenticated identity, once', () => {
	stageLoginRecoveryPassword('@a:test', 'synthetic');
	expect(consumeLoginRecoveryPassword('@a:test')).toBe('synthetic');
	expect(consumeLoginRecoveryPassword('@a:test')).toBeNull();
});
it('drops the handoff on an account mismatch and on expiry', () => {
	vi.useFakeTimers();
	stageLoginRecoveryPassword('@a:test', 'synthetic');
	expect(consumeLoginRecoveryPassword('@b:test')).toBeNull();
	expect(consumeLoginRecoveryPassword('@a:test')).toBeNull();
	stageLoginRecoveryPassword('@a:test', 'synthetic');
	vi.advanceTimersByTime(120000);
	expect(consumeLoginRecoveryPassword('@a:test')).toBeNull();
});
