import { describe, expect, it } from 'vite-plus/test';
import { toRegistrationUsername } from '../components/registration/accountData/registrationUsername';
import { generatePseudonym } from './anonName/engine';
import {
	isLegacyGuestLoginLabel,
	resolveAnonymousChatDisplayName
} from './anonymousChatDisplayName';

/* ORISO-Frontend#2347: the prefix only decides which label to show, never
   whether someone is a guest. */
describe('isLegacyGuestLoginLabel', () => {
	it.each(['anon_12', 'Anonymous-1700000000000', '  anon_5  '])(
		'recognises the historical guest login %s',
		(label) => {
			expect(isLegacyGuestLoginLabel(label)).toBe(true);
		}
	);

	it('does not flag a rolled animal User-ID', () => {
		const handle = toRegistrationUsername(generatePseudonym('de'));
		expect(isLegacyGuestLoginLabel(handle)).toBe(false);
	});

	it.each(['anonymous_reader', 'Anonymus', 'anon', '', undefined, null])(
		'does not flag %s',
		(label) => {
			expect(isLegacyGuestLoginLabel(label)).toBe(false);
		}
	);
});

describe('resolveAnonymousChatDisplayName', () => {
	it('shows the chosen display name over a legacy anon_N login', () => {
		expect(
			resolveAnonymousChatDisplayName({
				username: 'anon_12',
				displayName: 'freundliche Katze Mika'
			})
		).toBe('freundliche Katze Mika');
	});

	it('shows a rolled animal User-ID as it is', () => {
		const handle = toRegistrationUsername(generatePseudonym('de'));
		expect(resolveAnonymousChatDisplayName({ username: handle })).toBe(
			handle
		);
	});

	it('returns null for a bare legacy login so callers use their fallback', () => {
		expect(resolveAnonymousChatDisplayName({ username: 'anon_12' })).toBe(
			null
		);
	});
});
