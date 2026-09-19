import { UserDataInterface } from '../../globalState/interfaces/UserDataInterface';

/**
 * Whether this account must establish a second factor before it may be used.
 *
 * The requirement is a server fact, not something the client derives: the
 * UserService sets `twoFactorAuth.isRequired` for counsellors whose login was
 * provisioned through the admin API, where an administrator chooses the initial
 * password and hands it over. Until a factor exists, that password is not a
 * secret only the counsellor holds.
 *
 * Deliberately NOT fail-closed on a missing flag. `isRequired` is absent on any
 * backend that predates it, and a frontend released ahead of the service would
 * otherwise lock out every counsellor at once. Blocking on an unknown that is
 * "no requirement" everywhere else is a worse failure than the one it prevents.
 *
 * It IS fail-closed on the other half: once the requirement is known, anything
 * but a confirmed active factor keeps the gate shut.
 */
export const requiresSecondFactorSetup = (
	userData?: Partial<UserDataInterface>
): boolean => {
	const twoFactorAuth = userData?.twoFactorAuth;

	if (!twoFactorAuth || twoFactorAuth.isRequired !== true) {
		return false;
	}

	return twoFactorAuth.isActive !== true;
};
