import { expect, it } from 'vitest';
import { getChatRecoveryPolicy } from './chatRecoveryPolicy';
it('keeps legacy and anonymous accounts on key recovery independently of defaults', () => {
	expect(getChatRecoveryPolicy({})).toEqual({ mode: 'RECOVERY_KEY' });
	expect(
		getChatRecoveryPolicy(
			{
				chatRecoveryMode: 'LOGIN_PASSWORD',
				chatRecoveryPolicyRevision: 2
			},
			true
		)
	).toEqual({ mode: 'RECOVERY_KEY' });
});
it('requires a valid immutable enrollment snapshot', () => {
	expect(
		getChatRecoveryPolicy({
			chatRecoveryMode: 'LOGIN_PASSWORD',
			chatRecoveryPolicyRevision: 2
		})
	).toEqual({ mode: 'LOGIN_PASSWORD', revision: 2 });
	expect(() =>
		getChatRecoveryPolicy({ chatRecoveryMode: 'LOGIN_PASSWORD' })
	).toThrow();
	expect(() =>
		getChatRecoveryPolicy({ chatRecoveryMode: 'unknown' })
	).toThrow();
});
