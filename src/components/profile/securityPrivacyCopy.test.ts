import { describe, expect, it } from 'vitest';
import de from '../../resources/i18n/de/common.json';
import en from '../../resources/i18n/en/common.json';

// The grouped page must preserve the two-term wording approved in #1621.
describe('Security and privacy recovery copy', () => {
	it.each([
		['de', de],
		['en', en]
	] as const)(
		'%s keeps password/recovery-key wording',
		(_locale, catalogue) => {
			const profile = catalogue.profile;
			const copy = [
				JSON.stringify(profile.securityPrivacy),
				profile.encryption.setup.cta,
				profile.encryption.status.ok,
				profile.encryption.status.notSetUp,
				profile.encryption.recover.cta,
				profile.encryption.reset.cta
			].join(' ');
			expect(copy).not.toMatch(/Tresor|vault/i);
			expect(profile.encryption.status.notSetUp).toMatch(
				/Ersatzschlüssel|recovery key/i
			);
		}
	);
});
