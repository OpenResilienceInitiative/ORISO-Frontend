// @vitest-environment oriso-jsdom
import { expect, it, vi } from 'vite-plus/test';
import {
	logout,
	teardownLocalSession,
	teardownPeerLocalSession
} from './logout';
import { apiKeycloakLogout } from '../../api/apiLogoutKeycloak';
import { apiSetLiveChatAvailability } from '../../api/apiSetLiveChatAvailability';
import {
	getMatrixClientService,
	setMatrixClientServiceRef
} from '../../services/matrixClientRegistry';
import type { MatrixClientService } from '../../services/matrixClientService';
import {
	getValueFromCookie,
	setValueInCookie
} from '../sessionCookie/accessSessionCookie';

vi.mock('../../api/apiLogoutKeycloak', () => ({ apiKeycloakLogout: vi.fn() }));
vi.mock('../../api/apiSetLiveChatAvailability', () => ({
	apiSetLiveChatAvailability: vi.fn()
}));

it('stops the peer document once and preserves a newer App session and Admin storage', async () => {
	const matrix = { stopAndCleanup: vi.fn(), logout: vi.fn() };
	setMatrixClientServiceRef(matrix as unknown as MatrixClientService);
	setValueInCookie('keycloak', 'newer-app-access');
	setValueInCookie('refreshToken', 'newer-app-refresh');
	localStorage.setItem('matrix_access_token', 'newer-device');
	localStorage.setItem('oriso-admin.auth.refresh_token_valid_until', '12345');
	sessionStorage.setItem('oriso-admin:chunk-reloaded', '1');

	teardownPeerLocalSession();
	teardownPeerLocalSession();
	teardownLocalSession();
	await logout(false);

	expect(matrix.stopAndCleanup).toHaveBeenCalledTimes(1);
	expect(matrix.logout).not.toHaveBeenCalled();
	expect(getMatrixClientService()).toBeNull();
	expect(apiKeycloakLogout).not.toHaveBeenCalled();
	expect(apiSetLiveChatAvailability).not.toHaveBeenCalled();
	expect(getValueFromCookie('keycloak')).toBe('newer-app-access');
	expect(getValueFromCookie('refreshToken')).toBe('newer-app-refresh');
	expect(localStorage.getItem('matrix_access_token')).toBe('newer-device');
	expect(
		localStorage.getItem('oriso-admin.auth.refresh_token_valid_until')
	).toBe('12345');
	expect(sessionStorage.getItem('oriso-admin:chunk-reloaded')).toBe('1');
});
