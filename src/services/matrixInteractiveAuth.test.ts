import { describe, expect, it, vi } from 'vitest';
import type { MatrixClient } from 'matrix-js-sdk';
import {
	createPasswordUiAuth,
	getDeviceSigningAuth,
	registerDeviceSigningAuth
} from './matrixInteractiveAuth';

describe('createPasswordUiAuth', () => {
	it('retries the device-signing upload with password UIA and the server session', async () => {
		const makeRequest = vi
			.fn()
			.mockRejectedValueOnce({ data: { session: 'uia-session' } })
			.mockResolvedValueOnce(undefined);
		const authenticate = createPasswordUiAuth(
			'@herb-powell:predev.oriso.org',
			'ephemeral-uia-password'
		);

		await authenticate(makeRequest);

		expect(makeRequest).toHaveBeenNthCalledWith(1, null);
		expect(makeRequest).toHaveBeenNthCalledWith(2, {
			type: 'm.login.password',
			identifier: {
				type: 'm.id.user',
				user: '@herb-powell:predev.oriso.org'
			},
			password: 'ephemeral-uia-password',
			session: 'uia-session'
		});
	});

	it('does not send the password after a non-UIA failure', async () => {
		const failure = new Error('network failed');
		const makeRequest = vi.fn().mockRejectedValueOnce(failure);
		const authenticate = createPasswordUiAuth(
			'@herb-powell:predev.oriso.org',
			'ephemeral-uia-password'
		);

		await expect(authenticate(makeRequest)).rejects.toBe(failure);
		expect(makeRequest).toHaveBeenCalledOnce();
		expect(makeRequest).toHaveBeenCalledWith(null);
	});
});

describe('device-signing auth registry', () => {
	it('keeps UIA credentials in memory and scoped to the Matrix client', () => {
		const firstClient = {} as MatrixClient;
		const secondClient = {} as MatrixClient;
		const authenticate = createPasswordUiAuth('@user:example.org', 'secret');

		registerDeviceSigningAuth(firstClient, authenticate);

		expect(getDeviceSigningAuth(firstClient)).toBe(authenticate);
		expect(getDeviceSigningAuth(secondClient)).toBeUndefined();
	});
});
