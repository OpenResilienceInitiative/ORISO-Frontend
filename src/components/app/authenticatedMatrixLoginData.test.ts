import { describe, expect, it } from 'vitest';
import { withAuthenticatedSessionContext } from './authenticatedMatrixLoginData';

describe('withAuthenticatedSessionContext', () => {
	it('preserves the transient device-signing UIA password', () => {
		const result = withAuthenticatedSessionContext(
			{
				accessToken: 'matrix-access-token',
				userId: '@marge:predev.example.org',
				deviceId: 'ORISO_WEB_MARGE',
				homeserverUrl: 'https://predev.example.org/matrix',
				uiaPassword: 'transient-password'
			},
			true
		);

		expect(result).toMatchObject({
			uiaPassword: 'transient-password',
			isAnonymous: true
		});
	});
});
