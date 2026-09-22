import { describe, expect, it } from 'vitest';
import {
	ACCOUNT_SETUP_STEPS,
	isAccountSetupPending,
	resolveAccountSetupStep
} from './accountSetupStep';

const account = (overrides: Record<string, unknown> = {}) =>
	({
		passwordChangeRequired: false,
		twoFactorAuth: {
			isEnabled: true,
			isRequired: false,
			isActive: false
		},
		...overrides
	}) as any;

const owesBoth = account({
	passwordChangeRequired: true,
	twoFactorAuth: { isEnabled: true, isRequired: true, isActive: false }
});

describe('resolveAccountSetupStep', () => {
	it('asks for the password first when both are owed', () => {
		expect(resolveAccountSetupStep(owesBoth)).toBe(
			ACCOUNT_SETUP_STEPS.PASSWORD
		);
	});

	it('moves on to the second factor once the password is the user’s own', () => {
		expect(
			resolveAccountSetupStep(
				account({
					passwordChangeRequired: false,
					twoFactorAuth: {
						isEnabled: true,
						isRequired: true,
						isActive: false
					}
				})
			)
		).toBe(ACCOUNT_SETUP_STEPS.SECOND_FACTOR);
	});

	it('lets the account through once both are settled', () => {
		expect(
			resolveAccountSetupStep(
				account({
					passwordChangeRequired: false,
					twoFactorAuth: {
						isEnabled: true,
						isRequired: true,
						isActive: true
					}
				})
			)
		).toBeNull();
	});

	it('asks only for the password when no second factor is owed', () => {
		expect(
			resolveAccountSetupStep(account({ passwordChangeRequired: true }))
		).toBe(ACCOUNT_SETUP_STEPS.PASSWORD);
	});

	it('asks for nothing when neither is owed', () => {
		expect(resolveAccountSetupStep(account())).toBeNull();
	});

	// Both flags are absent on any backend released before them. Blocking then
	// would lock out every counsellor at once over unknowns that mean "nothing
	// owed" everywhere else.
	it('asks for nothing when the backend sends neither flag', () => {
		expect(
			resolveAccountSetupStep({
				twoFactorAuth: { isEnabled: true, isActive: false }
			} as any)
		).toBeNull();
		expect(resolveAccountSetupStep({} as any)).toBeNull();
		expect(resolveAccountSetupStep(undefined)).toBeNull();
	});

	// Fail closed on the half that is known: a stated requirement is only
	// settled by a confirmed result, never by a missing one.
	it('keeps asking for the second factor when its state is unknown', () => {
		expect(
			resolveAccountSetupStep(
				account({ twoFactorAuth: { isRequired: true } })
			)
		).toBe(ACCOUNT_SETUP_STEPS.SECOND_FACTOR);
	});

	it('is not satisfied by truthy non-boolean values', () => {
		expect(
			resolveAccountSetupStep(
				account({ passwordChangeRequired: 'yes' as any })
			)
		).toBeNull();
		expect(
			resolveAccountSetupStep(
				account({
					passwordChangeRequired: true,
					twoFactorAuth: { isRequired: true, isActive: 'yes' }
				})
			)
		).toBe(ACCOUNT_SETUP_STEPS.PASSWORD);
	});
});

// The side effects the app boots before it renders anything — joining a group
// chat from a deep link, starting live-event processing, asking for
// notification permission — have to consult the same fact the gate does, or the
// gate only hides a session that already has chat access.
describe('isAccountSetupPending', () => {
	it('is true while any step is owed', () => {
		expect(isAccountSetupPending(owesBoth)).toBe(true);
		expect(
			isAccountSetupPending(account({ passwordChangeRequired: true }))
		).toBe(true);
		expect(
			isAccountSetupPending(
				account({
					twoFactorAuth: { isRequired: true, isActive: false }
				})
			)
		).toBe(true);
	});

	it('is false once nothing is owed', () => {
		expect(isAccountSetupPending(account())).toBe(false);
	});

	it('is false when the backend sends neither flag', () => {
		expect(isAccountSetupPending({} as any)).toBe(false);
		expect(isAccountSetupPending(undefined)).toBe(false);
	});
});
