import { describe, expect, it } from 'vite-plus/test';
import {
	buildPersonalRegistrationLink,
	isValidPublicSlug
} from './publicContactLink';

// ORISO-UserService#1534: same rule as the UserService (PublicSlugFormat).
describe('isValidPublicSlug', () => {
	// The UserService looks names up as consultant ids first, so a name that
	// parses as a UUID (Java UUID.fromString: five hex groups) could never be
	// opened and is rejected there.
	it.each([
		'1-2-3-4-5',
		'a-b-c-d-e',
		'deadbeef-1-2-3-4',
		'4fa1c9e2-0b7d-4c3a-9e11-2f5c6d7e8a90'
	])('rejects the id-shaped "%s"', (slug) => {
		expect(isValidPublicSlug(slug)).toBe(false);
	});

	it.each(['1-2-3-4', '1-2-3-4-5-6', 'team-2-3-4-x'])(
		'accepts the non-id "%s"',
		(slug) => {
			expect(isValidPublicSlug(slug)).toBe(true);
		}
	);

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
