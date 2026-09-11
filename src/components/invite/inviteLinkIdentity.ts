import {
	generatePassword,
	generatePseudonym,
	regeneratePseudonym,
	type Pseudonym
} from '../../utils/anonName/engine';
import { toRegistrationUsername } from '../registration/accountData/registrationUsername';

export type InviteGuestCredentials = {
	identity: Pseudonym;
	username: string;
	password: string;
};

/** Mint the same animal User-ID + engine password used by registration / live chat. */
export const mintInviteGuestCredentials = (
	locale: string
): InviteGuestCredentials => {
	const identity = generatePseudonym(locale);
	return {
		identity,
		username: toRegistrationUsername(identity),
		password: generatePassword()
	};
};

/** Re-roll only the User-ID; the password stays until the guest continues. */
export const rerollInviteGuestUsername = (
	current: Pseudonym,
	locale: string
): Pick<InviteGuestCredentials, 'identity' | 'username'> => {
	const identity = regeneratePseudonym(current, locale);
	return {
		identity,
		username: toRegistrationUsername(identity)
	};
};
