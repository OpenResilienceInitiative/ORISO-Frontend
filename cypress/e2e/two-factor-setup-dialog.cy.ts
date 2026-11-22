import { mockConsultantShell } from '../support/mockConsultantShell';
import { endpoints } from '../../src/resources/scripts/endpoints';
import { USER_CONSULTANT } from '../support/commands/mockApi';
import {
	closeWebSocketServer,
	mockWebSocket,
	startWebSocketServer
} from '../support/websocket';

const TWO_FACTOR_SECRET = '12345678901234567890123456789012';
const TWO_FACTOR_QR_CODE = 'iVBORw0KGgo=';

const parseBody = (body) =>
	typeof body === 'string' ? JSON.parse(body) : body;

const prepareInactiveTwoFactorConsultant = (required = false) => {
	const secondFactor = {
		isActive: false,
		isEnabled: true,
		isRequired: required,
		qrCode: TWO_FACTOR_QR_CODE,
		secret: TWO_FACTOR_SECRET,
		type: ''
	};
	cy.willReturn('userData', { twoFactorAuth: secondFactor }, true);

	let appConfigured = false;
	if (required) {
		cy.fixture('service.users.data').then((users) => {
			const consultant = users.find(
				({ userId }) => userId === USER_CONSULTANT
			);
			cy.intercept('GET', endpoints.userData, (request) => {
				request.reply({
					...consultant,
					passwordChangeRequired: false,
					twoFactorAuth: {
						...secondFactor,
						isActive: appConfigured,
						type: appConfigured ? 'APP' : ''
					}
				});
			}).as('usersData');
		});
	}

	cy.intercept('PUT', endpoints.twoFactorAuthApp, (request) => {
		appConfigured = true;
		request.reply({ statusCode: 204 });
	}).as('putTwoFactorApp');
	cy.intercept('PUT', endpoints.twoFactorAuthEmail, {
		statusCode: 204
	}).as('putTwoFactorEmail');
	cy.intercept('POST', `${endpoints.twoFactorAuthEmail}/validate/*`, {
		statusCode: 204
	}).as('postTwoFactorEmailCode');
	cy.intercept('PATCH', endpoints.userData, (req) => {
		if (req.body && parseBody(req.body)?.encourage2fa === false) {
			req.alias = 'patchEncourage2fa';
		}
		req.reply({ statusCode: 204 });
	});

	cy.fastLogin({
		userId: USER_CONSULTANT,
		waitForSessionList: !required
	});
	if (!required) {
		cy.window().then((win) => {
			win.localStorage.setItem('2fa', '0');
			win.dispatchEvent(new win.Event('devToolbar'));
		});
	}
};

describe('two-factor setup dialog', () => {
	before(() => {
		startWebSocketServer();
	});

	after(() => {
		closeWebSocketServer();
	});

	beforeEach(() => {
		mockWebSocket();
		mockConsultantShell();
	});

	it('opens from profile security settings and completes email setup', () => {
		prepareInactiveTwoFactorConsultant();

		cy.visit('/profile/einstellungen/sicherheit');
		cy.contains('Zwei-Faktor-Authentifizierung').should('exist');
		cy.get('.twoFactorAuth__switch [role="switch"]')
			.parent('label')
			.click();

		cy.contains('Zweiten Faktor wählen');
		cy.get('.app').should('have.class', 'app--blur');
		cy.get('.twoFactorSetupDialog__backdrop').should('exist');
		cy.contains('button', 'E-Mail-Code verwenden').click();
		cy.contains('Geben Sie die E-Mail-Adresse ein');
		cy.contains('button', 'Weiter').click();

		cy.wait('@putTwoFactorEmail').then(({ request }) => {
			expect(parseBody(request.body)).to.deep.equal({
				email: 'con@sulta.nt'
			});
		});
		cy.contains('Wir haben gerade eine E-Mail an con@sulta.nt gesendet');

		cy.contains('button', 'Neuen Code senden').click();
		cy.wait('@putTwoFactorEmail');
		cy.get('#two-factor-setup-otp').type('654321');
		cy.contains('button', 'Bestätigen').click();

		cy.wait('@postTwoFactorEmailCode')
			.its('request.url')
			.should('contain', '/service/users/2fa/email/validate/654321');
		cy.wait('@patchEncourage2fa').then(({ request }) => {
			expect(parseBody(request.body)).to.deep.equal({
				encourage2fa: false
			});
		});
		cy.contains('E-Mail-Authentifizierung erfolgreich eingerichtet.');
	});

	it('requires the second factor before granting access and completes app setup', () => {
		prepareInactiveTwoFactorConsultant(true);

		cy.get('.accountSetupGate').should('be.visible');
		cy.get('a[href="/sessions/consultant/sessionPreview"]').should(
			'not.exist'
		);

		cy.contains('Zweiten Faktor wählen');
		cy.get('.app').should('have.class', 'app--blur');
		cy.get('.twoFactorSetupDialog__backdrop').should('exist');
		cy.get('.twoFactorSetupDialog__close').should('not.exist');
		cy.contains('button', 'Schließen').should('not.exist');

		cy.contains('button', 'Sicher per App verbinden').click();
		cy.contains('Authenticator-App installieren');
		cy.contains('button', 'App ist installiert – weiter').click();
		cy.contains('Manueller Schlüssel');
		cy.contains('button', 'Weiter').click();
		cy.get('#two-factor-setup-otp').type('123456');
		cy.contains('button', 'Bestätigen').click();

		cy.wait('@putTwoFactorApp').then(({ request }) => {
			expect(parseBody(request.body)).to.deep.equal({
				otp: '123456',
				secret: TWO_FACTOR_SECRET
			});
		});
		cy.wait('@patchEncourage2fa');
		cy.get('.accountSetupGate').should('not.exist');
		cy.get('a[href="/sessions/consultant/sessionPreview"]').should(
			'be.visible'
		);
	});
});
