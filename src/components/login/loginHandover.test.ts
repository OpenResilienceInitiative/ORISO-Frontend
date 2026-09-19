import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

/**
 * #1402: a counsellor with a second factor signed in successfully and stayed
 * on the login form.
 *
 * Measured on dev.oriso.org (build `cfb38b8`) on 2026-09-17: the realm
 * answered `400 Missing totp / otpType APP`, the one-time code was accepted
 * with `200` and a token, the user data loaded — and then the client-side
 * `navigate('/app')` pushed the new path into the history without the router
 * ever committing the route. The login form stayed on screen indefinitely at
 * `/app`. Dispatching a `popstate`, or reloading the same URL, rendered the
 * counsellor's session list at once.
 *
 * The hand-over out of the login screen is therefore a document load. This
 * guard keeps it one: a `navigate` handed to `redirectToApp` reintroduces the
 * exact stall the issue reported, and no test that renders the login form can
 * catch it, because the stall lives in the router's transition, not in the
 * component.
 */
describe('login hand-over into the authenticated app', () => {
	const source = readFileSync(join(__dirname, 'Login.tsx'), 'utf8');

	it('never hands the router navigation to redirectToApp', () => {
		const calls = source.match(/redirectToApp\([\s\S]*?\)\s*[;,)]/g) ?? [];

		expect(calls.length).toBeGreaterThan(0);
		for (const call of calls) {
			expect(call).not.toMatch(/\bnavigate\b/);
		}
	});
});
