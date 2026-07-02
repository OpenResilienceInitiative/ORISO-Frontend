// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

const loadEndpoints = async (env: Record<string, string | undefined> = {}) => {
	vi.resetModules();
	vi.stubEnv('NODE_ENV', 'production');
	vi.stubEnv('REACT_APP_KEYCLOAK_REALM', 'online-beratung');
	vi.stubEnv('REACT_APP_API_URL', 'https://api.oriso.org');

	for (const [key, value] of Object.entries(env)) {
		if (value === undefined) {
			continue;
		}
		vi.stubEnv(key, value);
	}

	return import('./endpoints');
};

afterEach(() => {
	vi.unstubAllEnvs();
	vi.resetModules();
});

describe('endpoints service origins', () => {
	it('uses service-specific origins when configured', async () => {
		const { endpoints } = await loadEndpoints({
			REACT_APP_USER_SERVICE_ORIGIN: 'http://localhost:8082/'
		});

		expect(endpoints.userData).toBe(
			'http://localhost:8082/service/users/data'
		);
		expect(endpoints.messages.get).toBe(
			'http://localhost:8082/service/messages'
		);
		expect(endpoints.matrixAccessToken).toBe(
			'http://localhost:8082/service/matrix/me/token'
		);
		expect(endpoints.anonymousEnquiryDetails(123)).toBe(
			'http://localhost:8082/service/conversations/anonymous/123'
		);
		expect(endpoints.tenantServiceBase).toBe(
			'https://api.oriso.org/service/tenant'
		);
	});

	it('falls back to the broad API origin when service origins are absent', async () => {
		const { endpoints } = await loadEndpoints();

		expect(endpoints.userData).toBe(
			'https://api.oriso.org/service/users/data'
		);
		expect(endpoints.matrixAccessToken).toBe(
			'https://api.oriso.org/service/matrix/me/token'
		);
		expect(endpoints.consultingTypeServiceBase).toBe(
			'https://api.oriso.org/service/consultingtypes'
		);
		expect(endpoints.keycloakAccessToken).toBe(
			'https://api.oriso.org/auth/realms/online-beratung/protocol/openid-connect/token'
		);
	});
});
