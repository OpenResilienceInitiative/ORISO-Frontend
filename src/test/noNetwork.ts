/**
 * Unit tests never reach the network. Without this, every request a test
 * leaves unmocked goes out for real (to `REACT_APP_API_URL`, a name that does
 * not resolve) and fails after an unpredictable delay: a few ms locally, up to
 * the 30 s connect timeout on a busy runner. When that late failure lands after
 * the file's jsdom was torn down, `fetchData` logs it through
 * `requestCollector`, which touches `window`, and Vitest fails the whole job on
 * `ReferenceError: window is not defined` although every test passed.
 *
 * Failing at once keeps the outcome a test already sees (a rejected `fetch`
 * with a `TypeError`, like a network error) but settles it inside the test.
 * Tests that need a response keep stubbing `fetch` (`vi.stubGlobal`,
 * `vi.spyOn`) or mocking the API module; both take precedence over this.
 */
const describeRequest = (input: RequestInfo | URL, init?: RequestInit) => {
	const request = input instanceof Request ? input : null;
	const url = request?.url ?? String(input);
	return `${init?.method ?? request?.method ?? 'GET'} ${url}`;
};

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
	throw new TypeError(
		`Unit tests have no network; mock this request: ${describeRequest(input, init)}`
	);
}) as typeof fetch;
