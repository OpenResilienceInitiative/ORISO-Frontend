import { describe, expect, it } from 'vitest';
import {
	getDisplayablePostcode,
	isAnonymousAskerCandidate,
	isAnonymousUsername
} from './sessionClassification';

describe('sessionClassification', () => {
	it('keeps registered enquiry sessions with real postcodes out of live chat', () => {
		expect(
			isAnonymousAskerCandidate({
				registrationType: 'REGISTERED',
				postcode: 12345,
				usernames: ['ruhiges Yak Kim']
			})
		).toBe(false);
	});

	it('formats real postcodes and suppresses anonymous postcode sentinels', () => {
		expect(getDisplayablePostcode(12345)).toBe('12345');
		expect(getDisplayablePostcode(' 99322 ')).toBe('99322');
		expect(getDisplayablePostcode(0)).toBeNull();
		expect(getDisplayablePostcode('00000')).toBeNull();
		expect(getDisplayablePostcode('')).toBeNull();
	});

	it('detects anonymous sessions from registration, username, and postcode markers', () => {
		expect(
			isAnonymousAskerCandidate({
				registrationType: 'ANONYMOUS',
				postcode: 12345
			})
		).toBe(true);
		expect(isAnonymousUsername('Anonymous-abc')).toBe(true);
		expect(isAnonymousUsername('anon_abc')).toBe(true);
		expect(
			isAnonymousAskerCandidate({
				postcode: '00000',
				usernames: ['ruhiges Yak Kim']
			})
		).toBe(true);
	});
});
