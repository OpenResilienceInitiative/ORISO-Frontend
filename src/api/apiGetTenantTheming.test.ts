// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	apiGetTenantTheming,
	resetLinkTenantCache
} from './apiGetTenantTheming';
import { getLinkAgencyId } from '../utils/linkAgencyId';
import { setValueInCookie } from '../components/sessionCookie/accessSessionCookie';

const mocks = vi.hoisted(() => ({
	fetchData: vi.fn(),
	apiGetAgencyById: vi.fn()
}));

vi.mock('./fetchData', async (importOriginal) => ({
	...(await importOriginal<typeof import('./fetchData')>()),
	fetchData: mocks.fetchData
}));

/** A Keycloak access token as the app stores it: only the payload is read. */
const tokenForTenant = (tenantId: unknown) =>
	`header.${btoa(JSON.stringify({ tenantId }))}.signature`;

vi.mock('./apiGetAgencyId', () => ({
	apiGetAgencyById: mocks.apiGetAgencyById
}));

const requestedUrl = () => mocks.fetchData.mock.calls.at(-1)[0].url as string;

describe('apiGetTenantTheming – which tenant is asked for', () => {
	beforeEach(() => {
		mocks.fetchData.mockReset().mockResolvedValue({});
		mocks.apiGetAgencyById.mockReset().mockResolvedValue(null);
		resetLinkTenantCache();
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

/**
 * #1689: a shared link names its Beratungsstelle (`?aid=`), so a visitor who
 * is not signed in — not even registered — already sees that Träger's CI.
 */
describe('apiGetTenantTheming – the Träger behind a shared link', () => {
	beforeEach(() => {
		mocks.fetchData.mockReset().mockResolvedValue({});
		mocks.apiGetAgencyById.mockReset();
		resetLinkTenantCache();
		document.cookie = 'keycloak=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
		window.localStorage.clear();
	});

	it("asks for the tenant of the link's Beratungsstelle", async () => {
		mocks.apiGetAgencyById.mockResolvedValue({ id: 1, tenantId: 2 });

		await apiGetTenantTheming(1);

		expect(mocks.apiGetAgencyById).toHaveBeenCalledWith(1);
		expect(requestedUrl()).toMatch(/\/service\/tenant\/public\/id\/2$/);
	});

	it('asks for the agency once for both theming hooks', async () => {
		mocks.apiGetAgencyById.mockResolvedValue({ id: 1, tenantId: 2 });

		await Promise.all([apiGetTenantTheming(1), apiGetTenantTheming(1)]);

		expect(mocks.apiGetAgencyById).toHaveBeenCalledTimes(1);
	});

	/* Codex on #1782: two separate tenant fetches could disagree, and the
	   one that failed then painted the main tenant over the link's. */
	it('gives both theming hooks the same link tenant from one request', async () => {
		mocks.apiGetAgencyById.mockResolvedValue({ id: 1, tenantId: 2 });
		mocks.fetchData
			.mockResolvedValueOnce({ id: 2 })
			.mockRejectedValueOnce(new Error('503'));

		const [first, second] = await Promise.all([
			apiGetTenantTheming(1),
			apiGetTenantTheming(1)
		]);

		expect(first).toEqual({ id: 2 });
		expect(second).toEqual({ id: 2 });
		expect(mocks.fetchData).toHaveBeenCalledTimes(1);
	});

	it.each([
		['an unknown agency', null],
		['an agency without a tenant', { id: 1 }],
		['the technical tenant 0', { id: 1, tenantId: 0 }]
	])('keeps the subdomain tenant for %s', async (_, agency) => {
		mocks.apiGetAgencyById.mockResolvedValue(agency);

		await apiGetTenantTheming(1);

		expect(requestedUrl()).toMatch(/\/service\/tenant\/public\/$/);
	});

	it("falls back to the subdomain tenant when the link's tenant fails", async () => {
		mocks.apiGetAgencyById.mockResolvedValue({ id: 1, tenantId: 2 });
		mocks.fetchData
			.mockRejectedValueOnce(new Error('404'))
			.mockResolvedValueOnce({});

		await apiGetTenantTheming(1);

		expect(requestedUrl()).toMatch(/\/service\/tenant\/public\/$/);
	});

	it('lets the signed-in tenant win over the link', async () => {
		setValueInCookie('keycloak', tokenForTenant(14));
		mocks.apiGetAgencyById.mockResolvedValue({ id: 1, tenantId: 2 });

		await apiGetTenantTheming(1);

		expect(mocks.apiGetAgencyById).not.toHaveBeenCalled();
		expect(requestedUrl()).toMatch(/\/service\/tenant\/public\/id\/14$/);
	});

	it.each([
		['?gcid=7&aid=19', 19],
		['?aid=0', null],
		['?aid=abc', null],
		['?aid=-3', null],
		['?gcid=7', null]
	])('reads the link agency from %s', (search, expected) => {
		expect(getLinkAgencyId(search)).toBe(expected);
	});

	it('asks for the agency again after a failed lookup', async () => {
		mocks.apiGetAgencyById
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce({ id: 1, tenantId: 2 });

		await apiGetTenantTheming(1);
		expect(requestedUrl()).toMatch(/\/service\/tenant\/public\/$/);

		await apiGetTenantTheming(1);
		expect(mocks.apiGetAgencyById).toHaveBeenCalledTimes(2);
		expect(requestedUrl()).toMatch(/\/service\/tenant\/public\/id\/2$/);
	});
});
