// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LANGUAGE_DATA } from './data';
import { generatePassword, generatePseudonym } from './engine';
import { allPasswordCriteriaPass } from '../../components/registration/accountData/passwordRules';

describe('anonymous name engine', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('normalizes locale variants before picking language data', () => {
		vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
			const values = array as Uint32Array;
			values.fill(0);
			return array;
		});

		const de = LANGUAGE_DATA.de;
		const fr = LANGUAGE_DATA.fr;

		expect(generatePseudonym('de@informal').displayName).toBe(
			`${de.groups[0].adjectives[0]} ${de.groups[0].animals[0].label} ${de.names[0]}`
		);
		expect(generatePseudonym('de-DE').displayName).toBe(
			`${de.groups[0].adjectives[0]} ${de.groups[0].animals[0].label} ${de.names[0]}`
		);
		expect(generatePseudonym('fr-FR').displayName).toBe(
			`${fr.groups[0].adjectives[0]} ${fr.groups[0].animals[0].label} ${fr.names[0]}`
		);
	});

	it('uses crypto randomness for generated passwords', () => {
		const getRandomValues = vi
			.spyOn(crypto, 'getRandomValues')
			.mockImplementation((array) => {
				const values = array as Uint32Array;
				values.fill(0);
				return array;
			});

		const password = generatePassword();

		expect(getRandomValues).toHaveBeenCalled();
		expect(password).toHaveLength(16);
		expect(allPasswordCriteriaPass(password)).toBe(true);
	});

	it('generates URI-safe passwords for the registration payload', () => {
		for (let i = 0; i < 50; i++) {
			const password = generatePassword();

			expect(encodeURIComponent(password)).toBe(password);
			expect(allPasswordCriteriaPass(password)).toBe(true);
		}
	});
});
