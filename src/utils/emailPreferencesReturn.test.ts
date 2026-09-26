import { describe, expect, it } from 'vitest';
import {
	emailPreferencesReturnPath,
	loginPathForEmailPreferences
} from './emailPreferencesReturn';

describe('email preference links across login', () => {
	it('preserves the occasion on the exact settings route', () => {
		expect(
			emailPreferencesReturnPath(
				'/profile/einstellungen/email?mail=tagesuebersicht'
			)
		).toBe('/profile/einstellungen/email?mail=tagesuebersicht');
		expect(
			loginPathForEmailPreferences(
				'/profile/einstellungen/email?mail=tagesuebersicht'
			)
		).toBe(
			'/login?returnTo=%2Fprofile%2Feinstellungen%2Femail%3Fmail%3Dtagesuebersicht'
		);
	});

	it('does not accept another route or an external destination', () => {
		for (const destination of [
			'https://evil.example/profile/einstellungen/email',
			'//evil.example/profile/einstellungen/email',
			'/profile/einstellungen/sicherheit',
			'/profile/einstellungen/email/other'
		]) {
			expect(emailPreferencesReturnPath(destination)).toBeNull();
			expect(loginPathForEmailPreferences(destination)).toBe('/login');
		}
	});

	it('drops unrelated query data and invalid occasion ids', () => {
		expect(
			emailPreferencesReturnPath(
				'/profile/einstellungen/email?mail=termin&token=secret'
			)
		).toBe('/profile/einstellungen/email?mail=termin');
		expect(
			emailPreferencesReturnPath(
				'/profile/einstellungen/email?mail=../login'
			)
		).toBe('/profile/einstellungen/email');
	});
});
