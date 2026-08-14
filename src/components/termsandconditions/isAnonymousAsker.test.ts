import { describe, expect, it } from 'vitest';
import { AUTHORITIES } from '../../globalState/helpers/stateHelpers';
import { UserDataInterface } from '../../globalState/interfaces';
import { isAnonymousAsker } from './isAnonymousAsker';

/**
 * ORISO-Frontend#1087 / ORISO-UserService#431.
 *
 * The privacy-update overlay is suppressed for anonymous askers: they consent at
 * entry through the platform-level live-chat notice, and their
 * `dataPrivacyConfirmation` is deliberately left empty so the in-chat gate fires
 * (ADR-018 §9). Detection used `userName.startsWith('Anonymous-')`, which never
 * matched a real user — so the overlay appeared for exactly the people it was
 * meant to exclude, and its only action fails for them, leaving a modal that
 * cannot be closed and blocks the entire live chat.
 */
describe('isAnonymousAsker', () => {
	it('recognises an anonymous asker by authority, whatever they are called', () => {
		// Real Pre-Dev names: anonymous users are anon_1 / anon_2, never Anonymous-*.
		expect(
			isAnonymousAsker({
				grantedAuthorities: [
					AUTHORITIES.ANONYMOUS_DEFAULT,
					AUTHORITIES.ASKER_DEFAULT
				]
			} as UserDataInterface)
		).toBe(true);
	});

	it('does not treat a registered asker as anonymous', () => {
		// Registered users carry generated animal names like schildkroete_hedi_5707.
		expect(
			isAnonymousAsker({
				grantedAuthorities: [AUTHORITIES.ASKER_DEFAULT]
			} as UserDataInterface)
		).toBe(false);
	});

	it('does not treat a consultant as anonymous', () => {
		expect(
			isAnonymousAsker({
				grantedAuthorities: [AUTHORITIES.CONSULTANT_DEFAULT]
			} as UserDataInterface)
		).toBe(false);
	});

	it('is false rather than throwing when the user data has not loaded yet', () => {
		expect(isAnonymousAsker(undefined)).toBe(false);
		expect(isAnonymousAsker({} as UserDataInterface)).toBe(false);
	});
});
