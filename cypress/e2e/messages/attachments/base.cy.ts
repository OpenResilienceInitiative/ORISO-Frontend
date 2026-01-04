import { SUB_STREAM_ROOM_MESSAGES } from '../../../../src/components/app/RocketChat';
import {
	closeWebSocketServer,
	mockWebSocket,
	startWebSocketServer
} from '../../../support/websocket';

describe('Messages - Attachments', () => {
	before(() => {
		startWebSocketServer();
	});

	after(() => {
		closeWebSocketServer();
	});

	beforeEach(() => {
		mockWebSocket();
	});

	it('should allow to send a message with attachment', () => {
		cy.fastLogin();

		cy.get('[data-cy=session-list-item]').click();
		cy.wait('@sessionRooms');
		cy.wait('@messages');

		cy.get('.textarea__attachmentInput').attachFile('empty.pdf');
		cy.get('.textarea__iconWrapper').click();

		cy.wait('@attachmentUpload');
	});
});
