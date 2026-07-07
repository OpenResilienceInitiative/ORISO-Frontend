import {
	closeWebSocketServer,
	mockWebSocket,
	startWebSocketServer
} from '../../cypress/support/websocket';
import { config } from '../../src/resources/scripts/config';

describe('Login', () => {
	before(() => {
		startWebSocketServer();
	});

	after(() => {
		closeWebSocketServer();
	});

	beforeEach(() => {
		cy.willReturn('frontend.settings', config);
		mockWebSocket();
	});

	it('should be able to login', () => {
		cy.login();

		cy.get('#appRoot').should('exist');
	});

	it('displays the consultingtype page at the root', () => {
		cy.visit('/');
		cy.contains('Willkommen bei der Online-Beratung');
	});

	it('displays the login for resorts', () => {
		cy.visit('/suchtberatung');
		cy.contains('Login');
	});

	it('recovers from a stale auth token instead of showing a blank login screen', () => {
		// Regression test for the production white screen: a returning user whose
		// Keycloak access token has expired still has the `keycloak` cookie, so
		// fetchData sends it as a Bearer token and the public topics endpoint
		// rejects it with 401. Previously the uncaught UNAUTHORIZED rejection left
		// #appRoot empty forever (and the stale cookie was never cleared, so every
		// reload repeated it). The app must now self-heal: clear the stale token,
		// reload anonymously and render the login form.
		cy.setCookie('keycloak', 'stale.invalid.token');

		// Mirror the backend: 401 while the stale bearer is sent, 200 once it is
		// gone. Registered after cy.mockApi() so it takes precedence.
		cy.intercept('GET', /\/service\/topic\/public\/?$/, (req) => {
			if (req.headers.authorization) {
				req.reply({ statusCode: 401, body: {} });
			} else {
				req.reply({ statusCode: 200, body: [] });
			}
		}).as('publicTopicsWithStaleToken');

		cy.visit('/login');

		cy.get('.loginForm').should('exist');
		cy.getCookie('keycloak').should('not.exist');
	});

	it('renders the login form when the public topics endpoint returns 401 with no token present', () => {
		// Tests the hadAuthorization=false branch of recoverFromStaleAuthOnPublicRoute.
		// When no keycloak cookie exists fetchData sends no Authorization header, so
		// the self-healing reload must NOT be triggered (there is nothing to heal).
		// The app should still reach a usable state rather than hanging on a blank page.

		// No keycloak cookie is set intentionally.

		// Backend returns 401 regardless -- simulates a misconfigured or unavailable
		// public endpoint. Without the Authorization-header guard the old code would
		// have skipped invalidateStaleAuthSession entirely and still rejected; the new
		// code always calls invalidateStaleAuthSession and rejects, but never reloads.
		cy.intercept('GET', /\/service\/topic\/public\/?$/, {
			statusCode: 401,
			body: {}
		}).as('publicTopicsUnauthorized');

		cy.visit('/login');

		// The login form must render: the UNAUTHORIZED rejection is now properly
		// handled by the component rather than left uncaught.
		cy.get('.loginForm').should('exist');

		// No stale cookie should have appeared as a side-effect.
		cy.getCookie('keycloak').should('not.exist');
	});

	it('does not reload infinitely when the backend keeps returning 401 after the stale token is cleared', () => {
		// Tests the staleAuthRecoveryTriggered guard: even if the public endpoint
		// continues to return 401 after the reload (e.g. a backend outage), the app
		// must not enter an infinite reload loop. The guard flag ensures at most one
		// self-healing reload per page load.
		cy.setCookie('keycloak', 'stale.invalid.token');

		let reloadCount = 0;

		// Always answer 401 -- even after the stale token has been cleared and the
		// second request carries no Authorization header.
		cy.intercept('GET', /\/service\/topic\/public\/?$/, (req) => {
			req.reply({ statusCode: 401, body: {} });
		}).as('publicTopicsAlways401');

		// Track reloads initiated by the application code so we can assert the guard.
		cy.visit('/login', {
			onBeforeLoad(win) {
				cy.stub(win.location, 'reload').callsFake(() => {
					reloadCount += 1;
					// Allow the stub to be observed without actually navigating away,
					// so the test can make assertions afterwards.
				});
			}
		});

		// Give the page enough time for any potential second reload to fire.
		// eslint-disable-next-line cypress/no-unnecessary-waiting
		cy.wait(2000);

		cy.wrap(null).then(() => {
			expect(reloadCount).to.equal(
				1,
				'window.location.reload should be called exactly once'
			);
		});
	});

	it('clears a stale token and recovers on a consulting-type registration route', () => {
		// isPublicAuthRoute() also matches /:slug/registration paths.
		// Verify that the same self-healing behaviour works on those routes, not
		// just on /login.
		cy.setCookie('keycloak', 'stale.invalid.token');

		cy.intercept('GET', /\/service\/topic\/public\/?$/, (req) => {
			if (req.headers.authorization) {
				req.reply({ statusCode: 401, body: {} });
			} else {
				req.reply({ statusCode: 200, body: [] });
			}
		}).as('publicTopicsRegistration');

		cy.visit('/suchtberatung/registration');

		// The stale cookie must be gone after recovery.
		cy.getCookie('keycloak').should('not.exist');
	});
});
