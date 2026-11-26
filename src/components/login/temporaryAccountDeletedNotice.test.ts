import { describe, expect, it } from 'vite-plus/test';
import {
	isTemporaryAccountDeletedNotice,
	loginUrlWithTemporaryAccountDeletedNotice
} from './temporaryAccountDeletedNotice';

describe('temporary account deleted notice (FE#2550)', () => {
	it('adds the notice to a plain login address', () => {
		expect(
			loginUrlWithTemporaryAccountDeletedNotice('https://app/login')
		).toBe('https://app/login?notice=temporary-account-deleted');
	});

	it('keeps parameters the login address already has', () => {
		expect(
			loginUrlWithTemporaryAccountDeletedNotice('https://app/login?a=1')
		).toBe('https://app/login?a=1&notice=temporary-account-deleted');
	});

	it('recognises only its own notice', () => {
		expect(
			isTemporaryAccountDeletedNotice('temporary-account-deleted')
		).toBe(true);
		expect(isTemporaryAccountDeletedNotice('something-else')).toBe(false);
		expect(isTemporaryAccountDeletedNotice(null)).toBe(false);
	});
});
