import type { TenantDataSettingsInterface } from '../src/globalState/interfaces';

/** One story's explicit permission snapshot; no shared mutable tenant registry. */
export const createTenantPublicStoryFetch = (
	delegate: typeof fetch,
	origin: string,
	settings: Partial<TenantDataSettingsInterface> = {}
): typeof fetch => {
	if (
		settings === null ||
		typeof settings !== 'object' ||
		Array.isArray(settings)
	)
		throw new Error('Story tenantSettings must be an object');
	const snapshot = structuredClone(settings);
	return async (input, init) => {
		const value =
			typeof input === 'string' || input instanceof URL
				? input
				: input.url;
		const url = new URL(value, origin);
		const method = (
			init?.method || (input instanceof Request ? input.method : 'GET')
		).toUpperCase();
		if (
			(url.origin === 'https://api.storybook.test' ||
				url.origin === origin) &&
			url.pathname === '/service/tenant/public/' &&
			url.search === '' &&
			method === 'GET'
		) {
			return new Response(
				JSON.stringify({
					id: 1,
					name: 'ORISO Storybook',
					settings: snapshot
				}),
				{ status: 200, headers: { 'content-type': 'application/json' } }
			);
		}
		// Existing strict service routing and local story interceptors retain
		// ownership of every other method, path, query and service origin.
		return delegate(input, init);
	};
};
