import { describe, expect, it } from 'vitest';
import { buildRegistrationLink } from './groupChatRegistrationLink';

describe('buildRegistrationLink', () => {
	it('preserves the Series invitation when login continues to registration', () => {
		expect(
			buildRegistrationLink(
				'https://app.oriso-dev.site/registration',
				'1013'
			)
		).toBe('https://app.oriso-dev.site/registration?gcid=1013');
	});

	it('keeps the normal registration URL without an invitation', () => {
		expect(
			buildRegistrationLink(
				'https://app.oriso-dev.site/registration',
				null
			)
		).toBe('https://app.oriso-dev.site/registration');
	});

	it("keeps the group's agency when login continues to registration", () => {
		expect(
			buildRegistrationLink(
				'https://dev.oriso.org/registration',
				'19',
				'19'
			)
		).toBe('https://dev.oriso.org/registration?gcid=19&aid=19');
	});

	it('does not forward an agency without an invitation', () => {
		expect(
			buildRegistrationLink(
				'https://dev.oriso.org/registration',
				null,
				'19'
			)
		).toBe('https://dev.oriso.org/registration');
	});
});
