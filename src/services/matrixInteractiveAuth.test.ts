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
			'@herb-powell:predev.example.org',
			'ephemeral-uia-password'
		);

		await authenticate(makeRequest);

		expect(makeRequest).toHaveBeenNthCalledWith(1, null);
		expect(makeRequest).toHaveBeenNthCalledWith(2, {
			type: 'm.login.password',
			identifier: {
				type: 'm.id.user',
				user: '@herb-powell:predev.example.org'
			},
			password: 'ephemeral-uia-password',
			session: 'uia-session'
		});
	});

	/**
	 * Every token fetch rotates the Matrix password server-side, so a password
	 * captured at client creation is stale as soon as another tab or device of
	 * the same account signs in (dev, 21.09.: reset failed with
	 * "Failed password login").
	 */
	it('fetches the password only when the server asks, so it is current', async () => {
		const makeRequest = vi
			.fn()
			.mockRejectedValueOnce({ data: { session: 'uia-session' } })
			.mockResolvedValueOnce(undefined);
		const currentPassword = vi.fn().mockResolvedValue('rotated-password');
		const authenticate = createPasswordUiAuth(
			'@herb-powell:predev.example.org',
			currentPassword
		);

		await authenticate(makeRequest);

		expect(currentPassword).toHaveBeenCalledOnce();
		expect(makeRequest).toHaveBeenLastCalledWith(
			expect.objectContaining({
				password: 'rotated-password',
				session: 'uia-session'
			})
		);
	});

	it('does not rotate the password when the server needs no UIA', async () => {
		const makeRequest = vi.fn().mockResolvedValueOnce(undefined);
		const currentPassword = vi.fn().mockResolvedValue('rotated-password');

		await createPasswordUiAuth(
			'@u:example.org',
			currentPassword
		)(makeRequest);

		expect(currentPassword).not.toHaveBeenCalled();
	});

	/**
	 * Another tab or device can rotate the password between fetching it and
	 * submitting it; Synapse then rejects it inside the same UIA session. The
	 * reset has already deleted state at that point, so it must not fail on a
	 * race it can recover from (#1504 review).
	 */
	it('retries once with a fresh password when Synapse rejects the one it had', async () => {
		const rejected = { data: { session: 'uia', errcode: 'M_FORBIDDEN' } };
		const makeRequest = vi
			.fn()
			.mockRejectedValueOnce({ data: { session: 'uia' } })
			.mockRejectedValueOnce(rejected)
			.mockResolvedValueOnce(undefined);
		const currentPassword = vi.fn().mockResolvedValue('rotated-again');

		await createPasswordUiAuth(
			'@u:example.org',
			'settled',
			currentPassword
		)(makeRequest);

		expect(currentPassword).toHaveBeenCalledOnce();
		expect(makeRequest).toHaveBeenCalledTimes(3);
		expect(makeRequest).toHaveBeenLastCalledWith(
			expect.objectContaining({
				password: 'rotated-again',
				session: 'uia'
			})
		);
	});

	it('gives up after one fresh retry', async () => {
		const rejected = { data: { session: 'uia', errcode: 'M_FORBIDDEN' } };
		const makeRequest = vi
			.fn()
			.mockRejectedValueOnce({ data: { session: 'uia' } })
			.mockRejectedValueOnce(rejected)
			.mockRejectedValueOnce(rejected);
		const currentPassword = vi.fn().mockResolvedValue('rotated-again');

		await expect(
			createPasswordUiAuth(
				'@u:example.org',
				'settled',
				currentPassword
			)(makeRequest)
		).rejects.toBe(rejected);
		expect(makeRequest).toHaveBeenCalledTimes(3);
	});

	it('does not send the password after a non-UIA failure', async () => {
		const failure = new Error('network failed');
		const makeRequest = vi.fn().mockRejectedValueOnce(failure);
		const authenticate = createPasswordUiAuth(
			'@herb-powell:predev.example.org',
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
		const authenticate = createPasswordUiAuth(
			'@user:example.org',
			'secret'
		);

		registerDeviceSigningAuth(firstClient, authenticate);

		expect(getDeviceSigningAuth(firstClient)).toBe(authenticate);
		expect(getDeviceSigningAuth(secondClient)).toBeUndefined();
	});
});
