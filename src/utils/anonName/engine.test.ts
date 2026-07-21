// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LANGUAGE_DATA } from './data';
import {
	contrastRatio,
	generateAvatarForUser,
	generatePassword,
	generatePseudonym,
	iconCandidates
} from './engine';
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

	it('exposes the structured animal + name parts of the display name', () => {
		vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
			const values = array as Uint32Array;
			values.fill(0);
			return array;
		});

		const de = LANGUAGE_DATA.de;
		const pseudonym = generatePseudonym('de');

		expect(pseudonym.animalLabel).toBe(de.groups[0].animals[0].label);
		expect(pseudonym.name).toBe(de.names[0]);
		expect(pseudonym.displayName).toContain(pseudonym.animalLabel);
		expect(pseudonym.displayName).toContain(pseudonym.name);
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

	it('generates a stable avatar for the same user id', () => {
		const first = generateAvatarForUser('client-asker-1');
		const second = generateAvatarForUser('client-asker-1');
		const other = generateAvatarForUser('consultant-2');

		expect(second).toEqual(first);
		expect(other).not.toEqual(first);
		expect(first.file).toBeTruthy();
		expect(first.bg).toMatch(/^#[0-9A-Fa-f]{6}$/);
		// Icon colour may now be black/white OR a complementary palette colour,
		// but must always be a valid hex from the candidate pool.
		expect(first.iconColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
		expect(iconCandidates(first.bg)).toContain(first.iconColor);
	});

	it('every icon candidate stays legible and keeps black/white in the pool', () => {
		for (let i = 0; i < 40; i++) {
			const { bg, iconColor } = generateAvatarForUser(`user-${i}`);
			const candidates = iconCandidates(bg);
			expect(candidates.length).toBeGreaterThan(0);
			// all candidates meet the WCAG floor
			candidates.forEach((c) =>
				expect(contrastRatio(bg, c)).toBeGreaterThanOrEqual(4.5)
			);
			// the classic high-contrast black/white is still offered
			expect(
				candidates.some((c) => c === '#1a1a1a' || c === '#ffffff')
			).toBe(true);
			// the chosen colour is legible
			expect(contrastRatio(bg, iconColor)).toBeGreaterThanOrEqual(4.5);
		}
	});
});
