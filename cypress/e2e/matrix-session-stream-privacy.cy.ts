import {
	closeWebSocketServer,
	mockWebSocket,
	startWebSocketServer
} from '../support/websocket';
import { USER_CONSULTANT } from '../support/commands/mockApi';

describe('Matrix session stream privacy', () => {
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

	it('does not hydrate opened Matrix sessions through the REST message proxy', () => {
		let restMessageRequests = 0;
		cy.consultantSession(
			{
				session: {
					id: 123,
					groupId: '!secure-room:oriso.org',
					matrixRoomId: '!secure-room:oriso.org',
					lastMessage: 'matrix plaintext preview must stay hidden',
					e2eLastMessage: {
						t: 'e2e',
						msg: 'encrypted preview must stay hidden'
					}
				}
			},
			0
		);
		cy.intercept('GET', '**/service/matrix/sessions/123/messages', (req) => {
			restMessageRequests += 1;
			req.reply({
				messages: [
					{
						event_id: '$event-id',
						sender: '@asker:oriso.org',
						origin_server_ts: 1782302400000,
						content: {
							msgtype: 'm.text',
							body: 'raw REST Matrix body must stay hidden'
						}
					}
				]
			});
		}).as('matrixRestMessages');

		cy.fastLogin({ userId: USER_CONSULTANT });
		cy.get('a[href="/sessions/consultant/sessionView"]').click();
		cy.wait('@consultantSessions');
		cy.get('[data-cy=session-list-item]').first().click();
		cy.location('pathname').should('contain', '/sessions/consultant/sessionView');
		cy.get('.contentWrapper__detail').should('be.visible');

		cy.then(() => {
			expect(restMessageRequests).to.equal(0);
		});
		cy.contains('raw REST Matrix body must stay hidden').should(
			'not.exist'
		);
	});

	it('keeps Matrix timeline hydration out of the REST message proxy source path', () => {
		cy.readFile('src/components/session/SessionStream.tsx').should(
			'not.contain',
			'service/matrix/sessions'
		);
	});

	it('does not keep a Matrix file-message REST sender helper around', () => {
		cy.readFile('src/api/apiMatrixUpload.ts').should(
			'not.contain',
			'/messages'
		);
	});

	it('does not keep a Matrix file upload REST proxy helper around', () => {
		cy.readFile('src/api/apiMatrixUpload.ts').should(
			'not.contain',
			'/service/matrix/sessions'
		);
	});
});
