import { USER_CONSULTANT } from '../support/commands/mockApi';
import { generateMultipleConsultantSessions } from '../support/sessions';
import {
	closeWebSocketServer,
	mockWebSocket,
	startWebSocketServer
} from '../support/websocket';
import {
	effectiveBackground,
	wcagContrast
} from '../../src/utils/theme/wcagContrast';

const route = '/profile/einstellungen/anzeige';
const card = '.personalDisplayProfile';

const selectSystemScheme = (value: 'light' | 'dark') =>
	cy.then(() =>
		Cypress.automation('remote:debugger:protocol', {
			command: 'Emulation.setEmulatedMedia',
			params: { features: [{ name: 'prefers-color-scheme', value }] }
		})
	);

describe('Personal display in the counsellor profile', () => {
	before(() => startWebSocketServer());
	after(() => closeWebSocketServer());

	for (const [width, height] of [
		[390, 844],
		[820, 1180]
	]) {
		it(`uses the live palette and keeps preferences after reload at ${width} × ${height}`, () => {
			mockWebSocket();
			cy.viewport(width, height);
			selectSystemScheme('light');
			cy.intercept('GET', '**/service/matrix/me/token*', {
				statusCode: 503
			});
			cy.intercept('GET', '**/service/addons/registry', { addons: [] });
			cy.intercept('POST', '**/service/error-reports*', {
				statusCode: 204
			});
			cy.intercept('GET', '**/service/users/calendar/proposals*', []);
			cy.intercept(
				'GET',
				'**/service/users/chat-series/join-requests*',
				[]
			);
			cy.intercept(
				'GET',
				'**/service/conversations/consultants/availability*',
				{ available: false }
			);
			const claims = btoa(
				JSON.stringify({
					iss: 'https://issuer.test',
					sub: USER_CONSULTANT,
					tenantId: 1,
					sid: 'display-profile-fixture',
					exp: Math.floor(Date.now() / 1000) + 3600
				})
			);
			cy.setCookie('keycloak', `fixture.${claims}.fixture`);
			generateMultipleConsultantSessions(3);
			cy.fastLogin({ userId: USER_CONSULTANT });
			cy.get('.navigation__mobileBar').should('be.visible');
			cy.get('.navigation__wrapper .personalDisplayEntry').should(
				'not.exist'
			);

			cy.contains('.navigation__mobileBar button', /^Mehr$/).click();
			cy.get('[role=dialog] a[href="/profile"]')
				.should('be.visible')
				.click();
			cy.location('pathname').should('eq', '/profile/allgemeines');
			cy.get('html').should(
				'have.attr',
				'data-oriso-personal-scheme',
				'light'
			);
			cy.get(`a[href="${route}"]`).scrollIntoView();
			cy.get(`a[href="${route}"]`).should('be.visible').click();
			cy.location('pathname').should('eq', route);
			cy.get(card).should('be.visible');
			cy.contains(card + ' h5', 'Zugänglichkeit').should('be.visible');

			cy.get(card + ' button[aria-label="Größer"]').click();
			cy.get(card + ' output').should('have.text', '150 %');
			cy.get(card + ' .personalDisplaySize__save').click();
			selectSystemScheme('dark');
			cy.get('html').should(
				'have.attr',
				'data-oriso-personal-scheme',
				'dark'
			);
			cy.contains(card + ' label', /^Hell$/).click();
			cy.get('html').should(
				'have.attr',
				'data-oriso-personal-scheme',
				'light'
			);
			cy.contains(card + ' label', /^Dunkel$/).click();
			cy.contains(card + ' label', /^Mittel$/).click();
			cy.get('html').should(
				'have.attr',
				'data-oriso-contrast-level',
				'medium'
			);
			cy.contains(card + ' label', /^Hoch$/).click();
			cy.get('html').should(
				'have.attr',
				'data-oriso-contrast-level',
				'high'
			);
			cy.get('html').should(
				'have.attr',
				'data-oriso-personal-text-size',
				'150'
			);

			cy.get(card).then(($card) => {
				const panel = $card[0];
				const styles = panel.ownerDocument.defaultView;
				const groupLabels = Array.from(
					panel.querySelectorAll('[role="radiogroup"]'),
					(group) => {
						const labelId = group.getAttribute('aria-labelledby');
						const label = labelId
							? panel.ownerDocument.getElementById(labelId)
							: null;
						if (!label)
							throw new Error('Missing display group label');
						return label;
					}
				);
				expect(groupLabels).to.have.length(2);
				const nodes = [
					...panel.querySelectorAll(
						'h5, legend, label, button, output'
					),
					...groupLabels
				];
				const measurements = nodes.map((node) => {
					const computed = styles.getComputedStyle(node);
					const background = effectiveBackground(node);
					return {
						label: node.textContent,
						fontSize: computed.fontSize,
						foreground: computed.color,
						background,
						contrast: wcagContrast(computed.color, background)
					};
				});
				expect(measurements).to.have.length(14);
				for (const { label, contrast } of measurements)
					expect(contrast, label).to.be.at.least(7);
				expect(
					measurements.find(({ label }) => label === 'Kontrast')
						?.fontSize
				).to.equal('24px');
				expect(
					measurements.find(({ label }) => label === 'Zugänglichkeit')
						?.fontSize
				).to.equal('36px');
				const cardBounds = panel.getBoundingClientRect();
				expect(cardBounds.left).to.be.at.least(0);
				expect(cardBounds.right).to.be.at.most(width);
				expect(panel.scrollWidth).to.be.at.most(panel.clientWidth + 1);
				cy.writeFile(
					`cypress/screenshots/counsellor-display.cy.ts/messwerte-${width}.json`,
					measurements
				);
			});
			cy.get('.profile__cards').then(($cards) => {
				const profileCards = $cards[0];
				const samples = [
					'.menuEffectsSettings .headline',
					'.menuEffectsSettings .text__standard',
					'[data-cy="timeline-settings"] .headline',
					'[data-cy="timeline-settings"] .radioButton__label'
				].map((selector) => {
					const node = profileCards.querySelector(selector);
					expect(node, selector).not.to.be.null;
					const { color } =
						node.ownerDocument.defaultView.getComputedStyle(node);
					const background = effectiveBackground(node);
					const contrast = wcagContrast(color, background);
					expect(contrast, selector).to.be.at.least(7);
					return { selector, color, background, contrast };
				});
				cy.writeFile(
					`cypress/screenshots/counsellor-display.cy.ts/nachbarkarten-${width}.json`,
					samples
				);
			});
			cy.get('.profile__innerWrapper').scrollTo('top');
			cy.screenshot(`beratenden-profil-${width}x${height}`, {
				capture: 'viewport',
				scale: false
			});

			cy.reload();
			cy.get('html')
				.should('have.attr', 'data-oriso-personal-scheme', 'dark')
				.and('have.attr', 'data-oriso-contrast-level', 'high')
				.and('have.attr', 'data-oriso-personal-text-size', '150');
			cy.contains(card + ' h5', 'Zugänglichkeit').should(
				'have.css',
				'font-size',
				'36px'
			);
			cy.get(card + ' output').should('have.text', '150 %');
			cy.contains(card + ' label', /^Dunkel$/)
				.find('input')
				.should('be.checked');
			cy.contains(card + ' label', /^Hoch$/)
				.find('input')
				.should('be.checked');
			cy.contains(card + ' label', /^Standard$/).click();
			cy.get('html').should(
				'have.attr',
				'data-oriso-contrast-level',
				'standard'
			);
			cy.get(card + ' output').should('have.text', '150 %');
		});
	}
});
