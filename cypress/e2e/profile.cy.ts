import { endpoints } from '../../src/resources/scripts/endpoints';
import {
	closeWebSocketServer,
	mockWebSocket,
	startWebSocketServer
} from '../support/websocket';
import { USER_CONSULTANT } from '../support/commands/mockApi';

// MUI's multiline field adds an aria-hidden textarea that only measures height.
const absenceTextarea =
	'#absenceForm .generalInformation textarea:not([aria-hidden="true"])';

describe('profile', () => {
	before(() => {
		startWebSocketServer();
	});

	after(() => {
		closeWebSocketServer();
	});

	beforeEach(() => {
		mockWebSocket();
	});

	describe('consultant absence', () => {
		beforeEach(() => {
			cy.fastLogin({
				userId: USER_CONSULTANT
			});
		});

		it('activate and deactivate absence consultant', () => {
			cy.contains('Profil').should('exist').click();

			cy.contains('Meine Aktivitäten').click();
			cy.contains('Hinterlegen Sie eine Abwesenheitsnachricht');

			cy.get('#absenceForm .mr--1').click();
			cy.get('.button__autoClose').click();
			cy.contains(
				'Deaktivieren Sie Ihre Abwesenheit, um eine Nachricht zu hinterlegen oder sie zu bearbeiten.'
			);
			cy.get(absenceTextarea).should('be.disabled');

			cy.get('#absenceForm .mr--1').click();
			cy.get('.button__autoClose').click();
			cy.contains('Hinterlegen Sie eine Abwesenheitsnachricht');
			cy.get(absenceTextarea).should('not.be.disabled');
		});

		it('activate and deactivate absence consultant with message', () => {
			cy.contains('Profil').should('exist').click();

			cy.contains('Meine Aktivitäten').click();
			cy.contains('Hinterlegen Sie eine Abwesenheitsnachricht');

			// The form re-renders once the profile data arrives; typing into
			// the first render fails with "the page updated" under load.
			cy.get(absenceTextarea).should('have.value', '').scrollIntoView();
			cy.get(absenceTextarea).type(
				'Liebe Ratsuchende, ich bin im Urlaub vom 23.05.2022 bis 05.06.2022.',
				{ delay: 0 }
			);
			cy.get('#absenceForm .mr--1').click();
			cy.get('.button__autoClose').click();
			cy.contains(
				'Deaktivieren Sie Ihre Abwesenheit, um eine Nachricht zu hinterlegen oder sie zu bearbeiten.'
			);
			cy.get(absenceTextarea).should('be.disabled');

			cy.get('#absenceForm .mr--1').click();
			cy.get('.button__autoClose').click();
			cy.contains('Hinterlegen Sie eine Abwesenheitsnachricht');
			cy.get(absenceTextarea).should('not.be.disabled');
		});
	});

	describe('consultant email notification', () => {
		beforeEach(() => {
			cy.fastLogin({
				userId: USER_CONSULTANT
			});
		});

		it('deactivate and activate email notification consultant', () => {
			cy.contains('Profil').should('exist').click();
			cy.contains('Einstellungen').should('exist').click();
			cy.contains('E-Mail-Benachrichtigungen');
			cy.get('.notifications__content .mr--1 input').should('be.checked');

			cy.get('.notifications__content .mr--1').click();
			cy.get('.notifications__content .mr--1 input').should(
				'not.be.checked'
			);

			cy.get('.notifications__content .mr--1').click();
			cy.get('.notifications__content .mr--1 input').should('be.checked');
		});
	});
});
