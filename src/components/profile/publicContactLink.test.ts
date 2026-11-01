import { describe, expect, it } from 'vite-plus/test';
import {
	buildPersonalRegistrationLink,
	isValidPublicSlug
} from './publicContactLink';

// ORISO-UserService#1534: same rule as the UserService (PublicSlugFormat).
describe('isValidPublicSlug', () => {
	it.each([
		'team-2',
		'beratung-24',
		'qa-shazia-2810',
		'qa-shazia-test',
		'2810'
	])('accepts %s', (slug) => {
		expect(isValidPublicSlug(slug)).toBe(true);
	});

	it.each([
		'-a',
		'a-',
		'a--b',
		'QA-Shazia',
		'qa shazia',
		'qa_shazia',
		'beratung-ü',
		''
	])('rejects "%s"', (slug) => {
		expect(isValidPublicSlug(slug)).toBe(false);
	});
});

describe('buildPersonalRegistrationLink', () => {
	it('builds the link the registration page resolves', () => {
		expect(
			buildPersonalRegistrationLink(
				'https://beratung.example.org/registration',
				'qa-shazia-2810'
			)
		).toBe('https://beratung.example.org/registration?cid=qa-shazia-2810');
	});
});
