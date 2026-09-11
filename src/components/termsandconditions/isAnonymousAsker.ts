import {
	AUTHORITIES,
	hasUserAuthority
} from '../../globalState/helpers/stateHelpers';
import { UserDataInterface } from '../../globalState/interfaces';

/**
 * Whether this user entered through an anonymous path (live chat / external inbound).
 *
 * Read from the granted authority, never from the username. Anonymous users are
 * named `anon_1`, `anon_2`, … and registered users get generated animal names
 * like `schildkroete_hedi_5707`; neither carries a stable prefix, and the name
 * is user-facing text that a carrier may allow overwriting. Anonymity is a
 * property of the account, not of its label.
 *
 * The previous `userName.startsWith('Anonymous-')` check never matched a real
 * user, so the privacy-update overlay appeared for exactly the people it was
 * written to exclude and could not be dismissed (ORISO-Frontend#1087).
 */
export const isAnonymousAsker = (userData?: UserDataInterface): boolean =>
	// `hasUserAuthority` returns undefined before the user data has loaded, and
	// the caller uses this to decide whether to render a blocking overlay — so
	// coerce rather than leaking a third state into a boolean contract.
	Boolean(hasUserAuthority(AUTHORITIES.ANONYMOUS_DEFAULT, userData));
