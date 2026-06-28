import {
	closeWebSocketServer,
	mockWebSocket,
	startWebSocketServer
} from '../support/websocket';
import { USER_CONSULTANT } from '../support/commands/mockApi';

describe('Session list Figma regression', () => {
	before(() => {
		startWebSocketServer();
	});

	after(() => {
		closeWebSocketServer();
	});

	beforeEach(() => {
		mockWebSocket();
	});

	it('renders registered Nähe sessions with postcode and stable menu interactions', () => {
		cy.consultantSession(
			{
				session: {
					id: 12345,
					status: 2,
					postcode: 12345,
					registrationType: 'REGISTERED',
					lastMessage: 'Anfrage Gesendet',
					e2eLastMessage: {
						t: '1606900238',
						msg: 'Anfrage Gesendet'
					}
				},
				user: {
					username: 'ruhiges Yak Kim'
				}
			},
			0
		);
		cy.consultantSession(
			{
				session: {
					id: 67890,
					status: 2,
					postcode: 99322,
					registrationType: 'REGISTERED',
					lastMessage: 'Hubi, schau dir das mal an!',
					e2eLastMessage: {
						t: '1606900238',
						msg: 'Hubi, schau dir das mal an!'
					}
				},
				user: {
					username: 'Ludwig Bonn'
				}
			},
			1
		);

		cy.fastLogin({
			userId: USER_CONSULTANT
		});

		cy.get('a[href="/sessions/consultant/sessionView"]').click();
		cy.wait('@consultantSessions');

		cy.location('pathname').should(
			'eq',
			'/sessions/consultant/sessionView'
		);
		cy.get('[data-cy=session-list-item]')
			.first()
			.as('registeredNearbySession')
			.should('contain.text', '12345')
			.and('contain.text', 'Nähe')
			.and('not.contain.text', 'Live Chat');
		cy.get('@registeredNearbySession')
			.find('.sessionsListItem__postcode')
			.should('contain.text', '12345');
		cy.get('@registeredNearbySession')
			.find('.sessionsListItem__consultingTypeIcon--nearbyLabel')
			.should('contain.text', 'Nähe');

		cy.get('@registeredNearbySession')
			.find('.sessionsListItem__menuIcon')
			.should('have.prop', 'tagName', 'BUTTON')
			.and('have.attr', 'type', 'button')
			.and('have.attr', 'aria-haspopup', 'dialog')
			.and('have.attr', 'aria-expanded', 'false')
			.as('menuButton');

		cy.get('@menuButton').click();
		cy.get('@menuButton')
			.should('have.attr', 'aria-expanded', 'true')
			.and('have.attr', 'aria-controls')
			.then((controls) => {
				cy.get(`#${controls}`).should('be.visible');
			});
		cy.get('.sessionsListItem__dropdown')
			.should('be.visible')
			.and('have.attr', 'role', 'dialog')
			.should(($menu) => {
				const rect = $menu[0].getBoundingClientRect();
				const viewportWidth =
					$menu[0].ownerDocument.defaultView?.innerWidth || 0;
				expect(rect.left).to.be.at.least(0);
				expect(rect.right).to.be.at.most(viewportWidth);
			});
		cy.get('.sessionsListItem__dropdownOption:not(:disabled)')
			.first()
			.should('have.focus')
			.and(($option) => {
				const style = getComputedStyle($option[0]);
				expect(style.backgroundColor).to.eq('rgb(231, 239, 252)');
				expect(style.outlineColor).to.eq('rgba(204, 30, 28, 0.42)');
				expect(style.outlineWidth).to.eq('2px');
			});
		cy.location('pathname').should(
			'eq',
			'/sessions/consultant/sessionView'
		);

		cy.get('body').click(0, 0);
		cy.get('.sessionsListItem__dropdown').should('not.exist');
		cy.get('@menuButton').should('have.attr', 'aria-expanded', 'false');

		cy.get('@menuButton').click();
		cy.get('.sessionsListItem__dropdown').should('be.visible');
		cy.location('pathname').should(
			'eq',
			'/sessions/consultant/sessionView'
		);
		cy.get('@menuButton').focus();
		cy.get('@menuButton').type('{esc}');
		cy.get('.sessionsListItem__dropdown').should('not.exist');
		cy.get('@menuButton').should('have.focus');

		cy.get('@menuButton').click();
		cy.get('.sessionsListItem__dropdownOption:not(:disabled)')
			.first()
			.should('have.focus')
			.trigger('keydown', { key: 'Tab' });
		cy.get('.sessionsListItem__dropdown').should('not.exist');
		cy.get('@menuButton').should('have.focus');

		cy.get('@menuButton').click();
		cy.get('.sessionsListItem__dropdown').should('be.visible');
		cy.get('[data-cy=session-list-item]')
			.eq(1)
			.as('secondRegisteredNearbySession')
			.invoke('attr', 'data-group-id')
			.then((secondGroupId) => {
				cy.window().then((win) => {
					win.history.pushState(
						{},
						'',
						`/sessions/consultant/sessionView/${secondGroupId}/67890`
					);
					win.dispatchEvent(new PopStateEvent('popstate'));
				});
			});
		cy.get('.sessionsListItem__dropdown').should('not.exist');
		cy.get('@secondRegisteredNearbySession')
			.should('contain.text', '99322')
			.and('contain.text', 'Nähe')
			.and('not.contain.text', 'Live Chat');
	});
});
