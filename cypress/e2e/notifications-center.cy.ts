import {
	closeWebSocketServer,
	mockWebSocket,
	startWebSocketServer
} from '../support/websocket';
import { USER_CONSULTANT } from '../support/commands/mockApi';

describe('Notifications center', () => {
	before(() => {
		startWebSocketServer();
	});

	after(() => {
		closeWebSocketServer();
	});

	beforeEach(() => {
		cy.mockApi();
		mockWebSocket();
	});

	it('does not fetch or render raw Matrix message bodies for notification previews', () => {
		let matrixPreviewRequests = 0;

		cy.willReturn('eventNotifications', {
			items: [
					{
						id: 42,
						eventType: 'message.new',
						category: 'message',
						title: 'Neue Nachricht',
						text: 'Sichere Nachricht im Gespräch',
					actionPath: '/profile/hilfe',
					actionLabel: 'Öffnen',
					sourceSessionId: 123,
					createdAt: '2026-06-24T12:00:00.000Z',
					readAt: null
				}
			],
			unreadCount: 1,
			page: 0,
			perPage: 50
		});

		cy.intercept(
			'GET',
			'**/service/matrix/sessions/123/messages',
			(req) => {
				matrixPreviewRequests += 1;
				req.reply({
					messages: [
						{
							event_id: 'event-1',
							sender: '@asker:oriso.org',
							origin_server_ts: 1782302400000,
							content: {
								msgtype: 'm.text',
								body: 'raw encrypted body from matrix service'
							}
						}
					]
				});
			}
		).as('matrixMessagePreview');

		cy.setCookie('keycloak', 'test-access-token');
		cy.fastLogin({
			userId: USER_CONSULTANT
		});
		cy.wait('@eventNotifications');

		cy.visit('/notifications');

			cy.contains('Neue Nachricht').should('be.visible');
			cy.contains('Sie haben eine neue Nachricht erhalten.').should(
				'be.visible'
			);
		cy.contains('raw encrypted body from matrix service').should(
			'not.exist'
		);
		cy.get('.notificationsCenter__chatPreview').should('not.exist');
		cy.get('@matrixMessagePreview.all').should('have.length', 0);
		cy.then(() => {
			expect(matrixPreviewRequests).to.equal(0);
		});
	});
});
