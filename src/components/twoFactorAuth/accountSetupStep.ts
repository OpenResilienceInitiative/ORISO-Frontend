import { UserDataInterface } from '../../globalState/interfaces/UserDataInterface';

/**
 * What an account still owes before it may be used. Both requirements are server facts. The
 * password comes first — enrolling a factor against credentials someone else still knows secures
 * the wrong thing.
 */
export const ACCOUNT_SETUP_STEPS = {
	PASSWORD: 'password',
	SECOND_FACTOR: 'secondFactor'
} as const;

export type AccountSetupStep =
	(typeof ACCOUNT_SETUP_STEPS)[keyof typeof ACCOUNT_SETUP_STEPS];

/**
 * NOT fail-closed on a missing flag: both are absent on any backend predating them, and a
 * frontend released ahead of the service would lock out every counsellor at once. It IS
 * fail-closed on the other half — once a requirement is stated, only a confirmed result settles it.
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

/**
 * Whether anything is still owed, for the side effects that run before the app renders.
 *
 * The gate replaces the screen but not the bootstrap that already ran: a deep-link group-chat join
 * mutates assignment server-side, and live events deliver counselling content. Both must consult
 * this same fact.
 */
export const isAccountSetupPending = (
	userData?: Partial<UserDataInterface>
): boolean => resolveAccountSetupStep(userData) !== null;
