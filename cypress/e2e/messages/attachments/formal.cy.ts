import {
	closeWebSocketServer,
	mockWebSocket,
	startWebSocketServer
} from '../../../support/websocket';

describe('Messages - Attachments - Formal', () => {
	before(() => {
		startWebSocketServer();
	});

	after(() => {
		closeWebSocketServer();
	});

	beforeEach(() => {
		mockWebSocket();
	});

	it('should show inline error when quota is reached', () => {
		cy.willReturn('attachmentUpload', {
			statusCode: 403,
			headers: {
				'X-Reason': 'QUOTA_REACHED'
			}
		});

		cy.fastLogin();

		cy.get('[data-cy=session-list-item]').click();
		cy.wait('@messages');

		cy.get('.textarea__attachmentInput').attachFile('empty.pdf');
		cy.get('.textarea__iconWrapper').click();

		cy.wait('@attachmentUpload');

		cy.window()
			.its('i18n')
			.then((i18n) => {
				i18n.changeLanguage('cimode');
				cy.contains('attachments.error.quota.headline');
			});
	});
});
