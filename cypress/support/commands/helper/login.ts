import { LoginArgs, USER_ASKER } from '../mockApi';

/**
 * With `cy.clock()` installed the app's timers only run when the test
 * ticks. The login page and the post-login handover (#2447) wait on
 * timers, so advance the clock in small steps until `selector` renders.
 */
export const tickUntil = (selector: string, step = 250, attempts = 120) =>
	cy.document({ log: false }).then((doc) => {
		if (doc.querySelector(selector)) {
			return;
		}
		if (attempts <= 0) {
			throw new Error(`tickUntil: ${selector} did not render`);
		}
		cy.tick(step, { log: false });
		cy.wait(10, { log: false }); // eslint-disable-line cypress/no-unnecessary-waiting
		tickUntil(selector, step, attempts - 1);
	});

Cypress.Commands.add('tickUntil', (selector: string) => tickUntil(selector));

const loginCommand = (getWillReturn, setWillReturn) =>
	Cypress.Commands.add(
		'login',
		(
			args: LoginArgs = {
				userId: USER_ASKER
			}
		) => {
			const userId = args.userId || USER_ASKER;

			if (args.auth) {
				setWillReturn('auth', {
					...getWillReturn('auth'),
					...args.auth
				});
			}

			cy.fixture('service.users.data').then((usersData) => {
				const userData = usersData.find((u) => u.userId === userId);
				setWillReturn('userData', userData, true);
				cy.setCookie('cy_username', userData.userName);
				cy.setCookie('cy_userId', userData.userId);

				cy.visit('/login');
				if (args.tickTimers) tickUntil('.loginForm');
				cy.get('.loginForm');
				cy.get('#username').type(userData.userName, { force: true });
				cy.get('#passwordInput').type('password', { force: true });
				cy.get('.button__primary').click();
				cy.wait('@authToken');
				if (args.tickTimers) {
					tickUntil('#appRoot');
					// The first list load waits for the boot screen to hand over.
					tickUntil('.sessionsListItem:not(.skeleton)');
				}
				cy.get('#appRoot').should('be.visible');
			});
		}
	);

export default loginCommand;
