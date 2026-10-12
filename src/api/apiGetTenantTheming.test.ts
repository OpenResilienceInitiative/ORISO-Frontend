// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiGetTenantTheming } from './apiGetTenantTheming';
import { setValueInCookie } from '../components/sessionCookie/accessSessionCookie';

const mocks = vi.hoisted(() => ({ fetchData: vi.fn() }));

vi.mock('./fetchData', async (importOriginal) => ({
	...(await importOriginal<typeof import('./fetchData')>()),
	fetchData: mocks.fetchData
}));

/** A Keycloak access token as the app stores it: only the payload is read. */
const tokenForTenant = (tenantId: unknown) =>
	`header.${btoa(JSON.stringify({ tenantId }))}.signature`;

const requestedUrl = () => mocks.fetchData.mock.calls.at(-1)[0].url as string;

describe('apiGetTenantTheming – which tenant is asked for', () => {
	beforeEach(() => {
		mocks.fetchData.mockReset().mockResolvedValue({});
		document.cookie = 'keycloak=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
		window.localStorage.clear();
	});

	it('asks for the subdomain tenant while nobody is signed in', async () => {
		await apiGetTenantTheming();

		expect(requestedUrl()).toMatch(/\/service\/tenant\/public\/$/);
	});

	// dev's Keycloak serialises the claim as a string, other realms as a number.
	it.each([
		['string', '14'],
		['number', 14]
	])(
		'asks for the tenant named in the token (%s claim)',
		async (_, claim) => {
			setValueInCookie('keycloak', tokenForTenant(claim));

			await apiGetTenantTheming();

			expect(requestedUrl()).toMatch(
				/\/service\/tenant\/public\/id\/14$/
			);
		}
	);

	it.each([
		['the technical tenant 0', 0],
		['a claim that is not a number', 'not-a-tenant'],
		['no claim at all', undefined]
	])('falls back to the subdomain tenant for %s', async (_, claim) => {
		setValueInCookie('keycloak', tokenForTenant(claim));

		await apiGetTenantTheming();

		expect(requestedUrl()).toMatch(/\/service\/tenant\/public\/$/);
	});
});
