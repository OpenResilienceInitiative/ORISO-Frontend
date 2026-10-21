import type { IUserDraftItem } from '../../api/apiUserDrafts';

const ownsDraftRead = (input: RequestInfo | URL, init?: RequestInit) => {
	const method =
		init?.method ?? (input instanceof Request ? input.method : 'GET');
	if (method.toUpperCase() !== 'GET') return false;
	let url: URL;
	try {
		url = new URL(input instanceof Request ? input.url : String(input));
	} catch {
		// Invalid/relative inputs belong to the captured fetch, including its errors.
		return false;
	}
	return (
		url.origin === 'https://api.storybook.test' &&
		url.pathname === '/service/users/drafts' &&
		url.hash === '' &&
		[...url.searchParams].length === 2 &&
		url.searchParams.get('page') === '0' &&
		url.searchParams.get('perPage') === '200'
	);
};

/** Exact synthetic list fixture owned by one notification story's beforeEach. */
export const installNotificationDraftFixture = (items: IUserDraftItem[]) => {
	const delegate = globalThis.fetch;
	const payload = JSON.stringify({ items, page: 0, perPage: 200 });
	let active = true;
	const ownedFetch: typeof fetch = function (
		this: unknown,
		input: RequestInfo | URL,
		init?: RequestInit
	) {
		// A saved reference also stops answering after verification restores fetch.
		if (
			active &&
			globalThis.fetch === ownedFetch &&
			ownsDraftRead(input, init)
		) {
			return Promise.resolve(
				new Response(payload, {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				})
			);
		}
		return delegate.call(this, input, init);
	};
	globalThis.fetch = ownedFetch;
	return () => {
		if (!active) return;
		active = false;
		// Never resurrect an old fetch over a newer story/operator/restored guard.
		if (globalThis.fetch === ownedFetch) globalThis.fetch = delegate;
	};
};
