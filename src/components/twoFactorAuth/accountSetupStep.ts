import { UserDataInterface } from '../../globalState/interfaces/UserDataInterface';

/**
 * What an account still owes before it may be used.
 *
 * Both requirements are server facts, not client derivations, and both exist
 * for the same reason: an account provisioned through the admin panel starts
 * with a password its administrator chose and passed on out of band. Replacing
 * that password makes the account the user's own; the second factor keeps it
 * that way. The password comes first — enrolling a factor against credentials
 * someone else still knows secures the wrong thing.
 */
export const ACCOUNT_SETUP_STEPS = {
	PASSWORD: 'password',
	SECOND_FACTOR: 'secondFactor'
} as const;

export type AccountSetupStep =
	(typeof ACCOUNT_SETUP_STEPS)[keyof typeof ACCOUNT_SETUP_STEPS];

/**
 * Deliberately NOT fail-closed on a missing flag. Both flags are absent on any
 * backend that predates them, and a frontend released ahead of the service
 * would otherwise lock out every counsellor at once. Blocking on an unknown
 * that means "nothing owed" everywhere else is the worse failure.
 *
 * It IS fail-closed on the other half: once a requirement is stated, only a
 * confirmed result settles it.
 */
export const resolveAccountSetupStep = (
	userData?: Partial<UserDataInterface>
): AccountSetupStep | null => {
	if (userData?.passwordChangeRequired === true) {
		return ACCOUNT_SETUP_STEPS.PASSWORD;
	}

	const twoFactorAuth = userData?.twoFactorAuth;
	if (twoFactorAuth?.isRequired === true && twoFactorAuth.isActive !== true) {
		return ACCOUNT_SETUP_STEPS.SECOND_FACTOR;
	}

	return null;
};
