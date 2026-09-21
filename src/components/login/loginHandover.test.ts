import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const loginSource = readFileSync(
	new URL('./Login.tsx', import.meta.url),
	'utf8'
);

/**
 * #1402: a counsellor signed in successfully -- Keycloak token, Matrix token
 * and /service/users/data all answered 200, the cookies were written -- and
 * was left looking at the login form, with the URL already on /app and a
 * valid session behind it. Only a reload got them in.
 *
 * `redirectToApp` hands over to the authenticated app. Given a `navigate` it
 * swaps the route client-side, under a React transition, so React keeps the
 * *previous* screen -- the login form -- painted until the lazily-imported
 * AuthenticatedApp chunk has resolved and committed. When that handover does
 * not complete, there is nothing on screen to say so.
 *
 * Leaving `navigate` off makes the handover a document load, which is what
 * the reload was doing by hand and what login did before the client-side nav
 * change. Registration is different: it passes `navigate` deliberately and
 * covers the gap with its handover animation.
 */
describe('the login screen hands over to the app with a document load', () => {
	const redirectCalls = [
		...loginSource.matchAll(/redirectToApp\(([\s\S]*?)\);/g)
	].map((match) => match[1]);

	it('calls redirectToApp somewhere in Login.tsx', () => {
		expect(redirectCalls.length).toBeGreaterThan(0);
	});

	it('never passes navigate to redirectToApp', () => {
		const withNavigate = redirectCalls.filter((args) =>
			/\bnavigate\b/.test(args)
		);
		expect(withNavigate).toEqual([]);
	});
});
