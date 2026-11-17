import { describe, expect, it } from 'vite-plus/test';
import {
	defaultGuestAccountMode,
	entryGuestAccountMode,
	GUEST_ACCOUNT_MODES,
	offeredGuestAccountModes,
	offersTemporaryAccount,
	readGuestAccountMode,
	withChosenAccount
} from './guestAccountMode';

describe('guest account mode (UserService#1662)', () => {
	it('lists the three modes in the order of the select', () => {
		expect(GUEST_ACCOUNT_MODES).toEqual([
			'TEMPORARY',
			'GUEST_CHOOSES',
			'PERMANENT'
		]);
	});

	it('defaults to a permanent account for chat and to the guest choosing for calls', () => {
		expect(defaultGuestAccountMode('CHAT')).toBe('PERMANENT');
		expect(defaultGuestAccountMode('AUDIO')).toBe('GUEST_CHOOSES');
		expect(defaultGuestAccountMode('VIDEO')).toBe('GUEST_CHOOSES');
	});

	it('reads the mode, and maps the old temporary switch like the backend', () => {
		expect(readGuestAccountMode('TEMPORARY', false)).toBe('TEMPORARY');
		expect(readGuestAccountMode('nonsense', true)).toBe('GUEST_CHOOSES');
		expect(readGuestAccountMode(undefined, true)).toBe('GUEST_CHOOSES');
		expect(readGuestAccountMode(null, false)).toBe('PERMANENT');
	});

	it('offers a temporary account unless the mode is permanent', () => {
		expect(offersTemporaryAccount('TEMPORARY')).toBe(true);
		expect(offersTemporaryAccount('GUEST_CHOOSES')).toBe(true);
		expect(offersTemporaryAccount('PERMANENT')).toBe(false);
	});

	it('offers only the modes the server allows, keeping the select order', () => {
		expect(offeredGuestAccountModes(undefined)).toEqual(
			GUEST_ACCOUNT_MODES
		);
		expect(offeredGuestAccountModes(['PERMANENT', 'TEMPORARY'])).toEqual([
			'TEMPORARY',
			'PERMANENT'
		]);
		expect(offeredGuestAccountModes(['BOGUS' as never])).toEqual([]);
	});

	describe('at the entry', () => {
		it('takes the mode from the invite context', () => {
			expect(
				entryGuestAccountMode({
					guestAccountMode: 'PERMANENT',
					temporaryAccount: true
				})
			).toBe('PERMANENT');
		});

		it('falls back to accessMode, then to the temporary flag, for an older server', () => {
			expect(
				entryGuestAccountMode({
					accessMode: 'BOTH',
					temporaryAccount: true
				})
			).toBe('GUEST_CHOOSES');
			expect(entryGuestAccountMode({ temporaryAccount: true })).toBe(
				'TEMPORARY'
			);
			expect(entryGuestAccountMode({ temporaryAccount: false })).toBe(
				'PERMANENT'
			);
		});

		it('fixes the account kind for TEMPORARY and PERMANENT, and follows the guest for GUEST_CHOOSES', () => {
			const context = { temporaryAccount: true };
			expect(
				withChosenAccount(
					{ ...context, guestAccountMode: 'TEMPORARY' },
					false
				).temporaryAccount
			).toBe(true);
			expect(
				withChosenAccount(
					{ ...context, guestAccountMode: 'PERMANENT' },
					true
				).temporaryAccount
			).toBe(false);
			expect(
				withChosenAccount(
					{ ...context, guestAccountMode: 'GUEST_CHOOSES' },
					false
				).temporaryAccount
			).toBe(false);
			expect(
				withChosenAccount(
					{ ...context, guestAccountMode: 'GUEST_CHOOSES' },
					true
				).temporaryAccount
			).toBe(true);
		});
	});
});
