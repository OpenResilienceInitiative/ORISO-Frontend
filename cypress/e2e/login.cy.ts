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
});
