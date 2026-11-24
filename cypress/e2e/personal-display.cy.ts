import { USER_ASKER } from '../support/commands/mockApi';
import { generateMultipleAskerSessions } from '../support/sessions';
import {
	closeWebSocketServer,
	mockWebSocket,
	startWebSocketServer
} from '../support/websocket';

const expectScale = (factor: string) => {
	cy.document().should((doc) => {
		const styles = doc.defaultView.getComputedStyle(doc.documentElement);
		expect(
			styles.getPropertyValue('--oriso-personal-text-scale').trim()
		).to.equal(factor);
	});
};

const selectSystemScheme = (value: 'light' | 'dark') =>
	cy.then(() =>
		Cypress.automation('remote:debugger:protocol', {
			command: 'Emulation.setEmulatedMedia',
			params: { features: [{ name: 'prefers-color-scheme', value }] }
		})
	);

describe('Personal display in the asker app', () => {
	before(() => startWebSocketServer());
	after(() => closeWebSocketServer());

	for (const [width, height] of [
		[390, 844],
		[820, 1180]
	]) {
		it(`keeps display settings after reload at ${width} × ${height}`, () => {
			mockWebSocket();
			cy.viewport(width, height);
			selectSystemScheme('light');
			cy.intercept('GET', '**/service/matrix/me/token*', {
				statusCode: 503
			});
			cy.intercept('GET', '**/service/addons/registry', { addons: [] });
			const claims = btoa(
				JSON.stringify({
					iss: 'https://issuer.test',
					sub: USER_ASKER,
					tenantId: 1,
					sid: 'display-fixture',
					exp: Math.floor(Date.now() / 1000) + 3600
				})
			);
			cy.setCookie('keycloak', `fixture.${claims}.fixture`);
			generateMultipleAskerSessions(3);
			cy.fastLogin();
			cy.location('pathname').should('eq', '/sessions/user/view');
			cy.get('.navigation__mobileBar').should('be.visible');

			cy.contains('button', /^Anzeige$/)
				.should('be.visible')
				.click();
			cy.get('[role=dialog] button[aria-label="Größer"]').click();
			cy.get('[role=dialog] output').should('have.text', '150 %');
			expectScale('');
			cy.get('[role=dialog] .personalDisplaySize__save').click();
			expectScale('1.5');

			selectSystemScheme('dark');
			cy.get('html').should(
				'have.attr',
				'data-oriso-personal-scheme',
				'dark'
			);
			cy.get('.personalDisplayDialog .m3Dialog__backdrop').should(
				($backdrop) => {
					expect(
						$backdrop[0].ownerDocument.defaultView.getComputedStyle(
							$backdrop[0]
						).backgroundColor
					).not.to.contain('255, 255, 255');
				}
			);
			selectSystemScheme('light');
			cy.get('html').should(
				'have.attr',
				'data-oriso-personal-scheme',
				'light'
			);

			cy.get('[role=dialog] button[aria-label="Kleiner"]').click();
			cy.get('[role=dialog] .personalDisplaySize__save').click();
			cy.get('[role=dialog] button[aria-label="Schließen"]').click();
			cy.contains('button', /^Anzeige$/).click();
			cy.get('[role=dialog] button[aria-label="Kleiner"]').click();
			cy.get('[role=dialog] output').should('have.text', '75 %');
			cy.get('[role=dialog] .personalDisplaySize__save').click();
			expectScale('0.75');
			cy.get('html').should(
				'not.have.attr',
				'data-oriso-personal-text-size'
			);

			cy.get('[role=dialog] button[aria-label="Größer"]').click().click();
			cy.get('[role=dialog] output').should('have.text', '150 %');
			cy.get('[role=dialog] .personalDisplaySize__save').click();
			cy.contains('label', /^Dunkel$/).click();
			cy.get('html').should(
				'have.attr',
				'data-oriso-personal-scheme',
				'dark'
			);
			expectScale('1.5');
			cy.get('html').should(
				'have.attr',
				'data-oriso-personal-text-size',
				'150'
			);
			cy.get('[role=dialog]').should('be.visible');
			cy.get('[role=dialog] fieldset')
				.first()
				.should(($group) => {
					const styles =
						$group[0].ownerDocument.defaultView.getComputedStyle(
							$group[0]
						);
					expect(styles.fontSize).to.equal('24px');
				});
			cy.screenshot(`ratsuchenden-menue-${width}x${height}`, {
				capture: 'viewport',
				scale: false
			});

			cy.reload();
			cy.contains('button', /^Anzeige$/).should('be.visible');
			cy.get('html').should(
				'have.attr',
				'data-oriso-personal-scheme',
				'dark'
			);
			expectScale('1.5');
			cy.get('html').should(
				'have.attr',
				'data-oriso-personal-text-size',
				'150'
			);
			cy.contains('button', /^Anzeige$/).click();
			cy.get('[role=dialog] output').should('have.text', '150 %');
			cy.contains('label', /^Dunkel$/)
				.find('input')
				.should('be.checked');
		});
	}
});
