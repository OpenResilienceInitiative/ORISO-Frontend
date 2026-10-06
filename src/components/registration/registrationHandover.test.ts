import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const registrationSource = readFileSync(
	new URL('./Registration.tsx', import.meta.url),
	'utf8'
);

/**
 * Same failure as #1402, on the registration side: the account was created,
 * auto-login succeeded and the URL already read /sessions/user/view/..., but
 * the registration form stayed painted. A client-side `navigate` swaps the
 * route under a React transition, so React keeps the previous screen up while
 * the lazy AuthenticatedApp chunk resolves -- and when that handover does not
 * complete, the user sits on a form whose User-ID is now taken (409) and
 * cannot get in.
 *
 * A document load is what a manual reload does. The welcome animation still
 * plays: POST_REGISTRATION_LOADER_KEY is read by AuthenticatedApp after the
 * load.
 */
describe('registration hands over to the app with a document load', () => {
	const redirectCalls = [
		...registrationSource.matchAll(/redirectToApp\(([\s\S]*?)\);/g)
	].map((match) => match[1]);

	it('calls redirectToApp somewhere in Registration.tsx', () => {
		expect(redirectCalls.length).toBeGreaterThan(0);
	});

	it('never passes navigate to redirectToApp', () => {
		const withNavigate = redirectCalls.filter((args) =>
			/\bnavigate\b/.test(args)
		);
		expect(withNavigate).toEqual([]);
	});
});
