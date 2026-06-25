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

const prepareInactiveTwoFactorConsultant = (showNag: boolean) => {
	if (showNag) {
		cy.willReturn('frontend.settings', {});
	}

	cy.willReturn(
		'userData',
		{
			twoFactorAuth: {
				isActive: false,
				isEnabled: true,
				qrCode: TWO_FACTOR_QR_CODE,
				secret: TWO_FACTOR_SECRET,
				type: ''
			}
		},
		true
	);

	cy.intercept('PUT', endpoints.twoFactorAuthApp, {
		statusCode: 204
	}).as('putTwoFactorApp');
	cy.intercept('PUT', endpoints.twoFactorAuthEmail, {
		statusCode: 204
	}).as('putTwoFactorEmail');
	cy.intercept('POST', `${endpoints.twoFactorAuthEmail}/validate/*`, {
		statusCode: 204
	}).as('postTwoFactorEmailCode');
	cy.intercept('PATCH', endpoints.userData, (req) => {
		if (parseBody(req.body)?.encourage2fa === false) {
			req.alias = 'patchEncourage2fa';
		}
		req.reply({
			statusCode: 204
		});
	});

	cy.fastLogin({ userId: USER_CONSULTANT });
	cy.window().then((win) => {
		if (showNag) {
			win.localStorage.setItem('2fa', '1');
		} else {
			win.localStorage.setItem('2fa', '0');
		}
		win.dispatchEvent(new win.Event('devToolbar'));
	});
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
	});

	it('opens from profile security settings and completes email setup', () => {
		prepareInactiveTwoFactorConsultant(false);

		cy.visit('/profile/einstellungen/sicherheit');
		cy.contains('Zwei-Faktor-Authentifizierung').should('exist');
		cy.get('.twoFactorAuth__switch').click();

		cy.contains('Welche Verbindung möchten Sie verwenden?');
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
		cy.get('.twoFactorSetupDialog__input input').type('654321');
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

	it('opens from the mandatory nag as a forced dialog and completes app setup', () => {
		prepareInactiveTwoFactorConsultant(true);

		cy.contains('Schützen Sie nun Ihr Konto').should('exist');
		cy.contains('button', 'Jetzt schützen').click();

		cy.contains('Welche Verbindung möchten Sie verwenden?');
		cy.get('.app').should('have.class', 'app--blur');
		cy.get('.twoFactorSetupDialog__backdrop').should('exist');
		cy.get('.twoFactorSetupDialog__close').should('not.exist');
		cy.contains('button', 'Schließen').should('not.exist');

		cy.contains('button', 'Sicher per App verbinden').click();
		cy.contains('Installieren Sie Google Authenticator');
		cy.contains('button', 'Weiter').click();
		cy.contains('Manueller Schlüssel');
		cy.contains('button', 'Weiter').click();
		cy.get('.twoFactorSetupDialog__input input').type('123456');
		cy.contains('button', 'Bestätigen').click();

		cy.wait('@putTwoFactorApp').then(({ request }) => {
			expect(parseBody(request.body)).to.deep.equal({
				otp: '123456',
				secret: TWO_FACTOR_SECRET
			});
		});
		cy.wait('@patchEncourage2fa');
		cy.contains('App-Authentifizierung erfolgreich eingerichtet.');
	});
});
