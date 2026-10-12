import { describe, expect, it } from 'vitest';
import { assertKeycloakMessageParity } from './keycloakMessageParity';

describe('Keycloak bundle key parity', () => {
	it('accepts the same keys regardless of order or translated values', () => {
		expect(() =>
			assertKeycloakMessageParity(
				{ subject: 'Hallo', body: 'Text' },
				{ body: 'Words', subject: 'Hello' },
				'en',
				'otp'
			)
		).not.toThrow();
	});

	it('rejects missing and extra keys', () => {
		expect(() =>
			assertKeycloakMessageParity(
				{ subject: 'Hallo', body: 'Text' },
				{ subject: 'Hello', extra: 'Surprise' },
				'en',
				'otp'
			)
		).toThrow('missing [body], extra [extra]');
	});
});
