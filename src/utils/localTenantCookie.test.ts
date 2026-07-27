// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	deleteCookieByName,
	setValueInCookie
} from '../components/sessionCookie/accessSessionCookie';
import { getLocalTenantId } from '../resources/scripts/runtimeConfig';
import { syncLocalTenantCookie } from './localTenantCookie';

vi.mock('../components/sessionCookie/accessSessionCookie', () => ({
	deleteCookieByName: vi.fn(),
	setValueInCookie: vi.fn()
}));

vi.mock('../resources/scripts/runtimeConfig', () => ({
	getLocalTenantId: vi.fn()
}));

describe('syncLocalTenantCookie', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('refreshes the tenant cookie on localhost when configured', () => {
		vi.mocked(getLocalTenantId).mockReturnValue('1');

		syncLocalTenantCookie('localhost');

		expect(deleteCookieByName).toHaveBeenCalledWith('tenantId');
		expect(setValueInCookie).toHaveBeenCalledWith('tenantId', '1');
	});

	it('clears stale localhost tenant cookies when config is absent', () => {
		vi.mocked(getLocalTenantId).mockReturnValue(undefined);

		syncLocalTenantCookie('127.0.0.1');

		expect(deleteCookieByName).toHaveBeenCalledWith('tenantId');
		expect(setValueInCookie).not.toHaveBeenCalled();
	});

	it('leaves non-localhost tenants untouched', () => {
		vi.mocked(getLocalTenantId).mockReturnValue('1');

		syncLocalTenantCookie('app.oriso-dev.site');

		expect(deleteCookieByName).not.toHaveBeenCalled();
		expect(setValueInCookie).not.toHaveBeenCalled();
	});
});
