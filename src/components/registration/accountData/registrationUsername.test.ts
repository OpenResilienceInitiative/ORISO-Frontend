import { describe, expect, it } from 'vitest';
import { toRegistrationUsername } from './registrationUsername';
import {
	REGISTRATION_DATA_VALIDATION,
	USERNAME_MAX_LENGTH
} from '../registrationDataValidation';
import {
	generatePseudonym,
	Pseudonym,
	SUPPORTED
} from '../../../utils/anonName/engine';

const identity = (partial: Partial<Pseudonym>): Pseudonym => ({
	displayName: 'freundliche Katze Mika',
	avatar: { file: 'cat.svg', bg: '#FFB3BA', iconColor: '#1a1a1a' },
	animalLabel: 'Katze',
	name: 'Mika',
	...partial
});

describe('toRegistrationUsername', () => {
	it('builds the handle from animal + name, dropping the adjective', () => {
		expect(toRegistrationUsername(identity({}))).toMatch(
			/^katze_mika_\d{4}$/
		);
	});

	it('never exceeds the backend username limit', () => {
		const longest = identity({
			animalLabel: 'Meerschweinchen',
			name: 'Dominique',
			displayName: 'sanftmütige Meerschweinchen Dominique'
		});
		for (let i = 0; i < 200; i++) {
			expect(toRegistrationUsername(longest).length).toBeLessThanOrEqual(
				USERNAME_MAX_LENGTH
			);
		}
	});

	it('passes the frontend username validation for every language', () => {
		for (const lang of SUPPORTED) {
			for (let i = 0; i < 50; i++) {
				const username = toRegistrationUsername(
					generatePseudonym(lang)
				);
				expect(
					REGISTRATION_DATA_VALIDATION.username.validation(username),
					`invalid username "${username}" (${lang})`
				).toBe(true);
			}
		}
	});

	it('handles multi-word animal labels', () => {
		const username = toRegistrationUsername(
			identity({
				animalLabel: 'Guinea Pig',
				name: 'Charlie',
				displayName: 'gentle Guinea Pig Charlie'
			})
		);
		expect(username).toMatch(/^guinea_pig_charlie_\d{4}$/);
	});

	it('never emits a trailing underscore before the numeric suffix', () => {
		for (const lang of SUPPORTED) {
			for (let i = 0; i < 50; i++) {
				const username = toRegistrationUsername(
					generatePseudonym(lang)
				);
				expect(username).not.toMatch(/__\d{4}$/);
			}
		}
	});

	it('falls back to a valid handle for legacy drafts without structured parts', () => {
		const legacy = {
			displayName: 'freundliche Katze Mika',
			avatar: { file: 'cat.svg', bg: '#FFB3BA', iconColor: '#1a1a1a' }
		} as Pseudonym;
		const username = toRegistrationUsername(legacy);
		expect(username.length).toBeLessThanOrEqual(USERNAME_MAX_LENGTH);
		expect(REGISTRATION_DATA_VALIDATION.username.validation(username)).toBe(
			true
		);
	});

	/* German spells its umlauts out when it cannot draw the dots: Löwe is
	   loewe, not lowe (Frank, 2026-09-10). The live chat's door shows this
	   string to the guest, so a swallowed umlaut is a visible typo. */
	it('spells out umlauts instead of stripping them', () => {
		const built = toRegistrationUsername({
			displayName: 'stiller Löwe Shin',
			animalLabel: 'Löwe',
			name: 'Shin'
		} as never);
		expect(built).toMatch(/^loewe_shin_\d{4}$/);

		expect(
			toRegistrationUsername({
				displayName: 'kleiner Käfer Uli',
				animalLabel: 'Käfer',
				name: 'Uli'
			} as never)
		).toMatch(/^kaefer_uli_\d{4}$/);

		expect(
			toRegistrationUsername({
				displayName: 'weiße Möwe Bo',
				animalLabel: 'Möwe',
				name: 'Straße'
			} as never)
		).toMatch(/^moewe_strasse_\d{4}$/);
	});
});
