// @vitest-environment jsdom
import * as React from 'react';
import { useEffect, useState } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleTokenRefresh } from './auth';
import { NotificationsProvider } from '../../globalState/provider/NotificationsProvider';
import { messageEventEmitter } from '../../services/messageEventEmitter';
import {
	getMatrixClientService,
	setMatrixClientServiceRef
} from '../../services/matrixClientRegistry';
import type { MatrixClientService } from '../../services/matrixClientService';

/*
 * Regression for the half-signed-out tab seen on dev on 2026-09-16: the
 * login form was on screen while the auth cookies, the token expiries and
 * the Matrix token were still in place, and the event-notification poller
 * kept hitting the backend with the leftover access token.
 *
 * Real modules on purpose: auth guard → logout teardown → cookie/Web Storage
 * helpers → NotificationsProvider. Only the network and the Matrix service
 * are faked.
 */

const apiGetEventNotifications = vi.fn();

vi.mock('../../api/apiEventNotifications', () => ({
	apiGetEventNotifications: (...args: unknown[]) =>
		apiGetEventNotifications(...args),
	apiGetEventNotificationsUnreadCount: vi.fn(() =>
		Promise.resolve({ unreadCount: 0 })
	),
	apiMarkEventNotificationRead: vi.fn(),
	apiMarkAllEventNotificationsRead: vi.fn(),
	apiMarkEventNotificationsReadByTypes: vi.fn(),
	apiClearEventNotifications: vi.fn(() => Promise.resolve())
}));
vi.mock('../../api/apiLogoutKeycloak', () => ({
	apiKeycloakLogout: vi.fn().mockResolvedValue(undefined)
}));
vi.mock('../../api/apiSetLiveChatAvailability', () => ({
	apiSetLiveChatAvailability: vi.fn().mockResolvedValue(undefined)
}));
vi.mock('../../utils/liveChatAvailabilityStorage', () => ({
	clearLiveChatAvailabilityPreference: vi.fn()
}));
vi.mock('../../utils/tenantSettingsHelper', () => ({
	getTenantSettings: () => ({
		featureAppointmentsEnabled: false,
		featureToolsEnabled: false
	})
}));
vi.mock('../budibase/budibaseLogout', () => ({ budibaseLogout: vi.fn() }));
vi.mock('../logout/calcomLogout', () => ({ calcomLogout: vi.fn() }));
vi.mock('../../services/matrixKeyBackupService', () => ({
	clearSecretStorageKeys: vi.fn()
}));
vi.mock('../../services/loginRecoveryHandoff', () => ({
	clearLoginRecoveryPassword: vi.fn()
}));
vi.mock('../../services/recoveryReminderState', () => ({
	clearRecoveryRuntimeState: vi.fn()
}));
vi.mock('../../utils/appConfig', () => ({
	appConfig: { urls: { toLogin: '/login', toEntry: '/' } }
}));

/** What AuthenticatedApp does: the guard decides, then the login form. */
const AuthGuardProbe = () => {
	const [showLogin, setShowLogin] = useState(false);
	useEffect(() => {
		handleTokenRefresh(false).catch(() => setShowLogin(true));
	}, []);
	return showLogin ? (
		<div data-testid="login-form" />
	) : (
		<div data-testid="loading" />
	);
};

const seedSession = ({ expired }: { expired: boolean }) => {
	const now = Date.now();
	document.cookie = 'keycloak=old-access;path=/';
	document.cookie = 'refreshToken=old-refresh;path=/';
	localStorage.setItem(
		'auth.access_token_valid_until',
		String(expired ? now - 60_000 : now + 5 * 60_000)
	);
	localStorage.setItem(
		'auth.refresh_token_valid_until',
		String(expired ? now - 26 * 60_000 : now + 30 * 60_000)
	);
	localStorage.setItem('matrix_access_token', 'syt_old');
	localStorage.setItem('matrix_user_id', '@old:hs');
	localStorage.setItem('matrix_device_id', 'ORISO_WEB_OLDDEVICE');
};

const fakeMatrixService = () =>
	({
		logout: vi.fn().mockResolvedValue(undefined),
		stopAndCleanup: vi.fn()
	}) as unknown as MatrixClientService & { logout: ReturnType<typeof vi.fn> };

describe('expired refresh token tears the session down before the login form', () => {
	beforeEach(() => {
		apiGetEventNotifications.mockReset();
		apiGetEventNotifications.mockResolvedValue({
			items: [],
			unreadCount: 0
		});
		localStorage.clear();
		sessionStorage.clear();
		document.cookie.split(';').forEach((cookie) => {
			const name = cookie.trim().split('=')[0];
			if (name) {
				document.cookie = `${name}=;path=/;expires=Thu, 01 Jan 1970 00:00:00 GMT`;
			}
		});
	});

	afterEach(() => {
		cleanup();
		setMatrixClientServiceRef(null);
	});

	// Control: with a live session the provider polls on mount. Without this
	// the "no fetch" assertion below would also pass for a broken provider.
	it('polls the notification feed while the session is valid', async () => {
		seedSession({ expired: false });

		render(
			<NotificationsProvider>
				<div />
			</NotificationsProvider>
		);

		await waitFor(() =>
			expect(apiGetEventNotifications).toHaveBeenCalled()
		);
	});

	it('clears auth and Matrix state, stops the Matrix client and issues no notification fetch next to the login form', async () => {
		seedSession({ expired: true });
		const matrixService = fakeMatrixService();
		setMatrixClientServiceRef(matrixService);

		render(
			<NotificationsProvider>
				<AuthGuardProbe />
			</NotificationsProvider>
		);

		await screen.findByTestId('login-form');

		// Everything logout would clear is gone — at the latest with the
		// render that shows the login form, not after some network round trip.
		expect(document.cookie).not.toContain('keycloak=');
		expect(document.cookie).not.toContain('refreshToken=');
		expect(
			localStorage.getItem('auth.access_token_valid_until')
		).toBeNull();
		expect(
			localStorage.getItem('auth.refresh_token_valid_until')
		).toBeNull();
		expect(localStorage.getItem('matrix_access_token')).toBeNull();
		expect(localStorage.getItem('matrix_user_id')).toBeNull();
		expect(localStorage.getItem('matrix_device_id')).toBeNull();
		expect(matrixService.logout).toHaveBeenCalledTimes(1);
		expect(getMatrixClientService()).toBeNull();

		// The poller must not touch the backend with a leftover token: not on
		// mount, and not when the (already stopped) Matrix sync's last echo
		// asks for a refetch.
		messageEventEmitter.emit({});
		await new Promise((resolve) => setTimeout(resolve, 600));
		expect(apiGetEventNotifications).not.toHaveBeenCalled();
	});
});
