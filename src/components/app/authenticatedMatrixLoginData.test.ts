import { describe, expect, it } from 'vitest';
import { withAuthenticatedSessionContext } from './authenticatedMatrixLoginData';

describe('withAuthenticatedSessionContext', () => {
	it('preserves UIA and marks an advice seeker for compatible key sharing', () => {
		const result = withAuthenticatedSessionContext(
			{
				accessToken: 'matrix-access-token',
				userId: '@marge:predev.oriso.org',
				deviceId: 'ORISO_WEB_MARGE',
				homeserverUrl: 'https://predev.oriso.org/matrix',
				uiaPassword: 'transient-password'
			},
			true
		);

		expect(result).toMatchObject({
			uiaPassword: 'transient-password',
			shareMegolmWithAllDevices: true
		});
	});
});
