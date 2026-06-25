import {
	closeWebSocketServer,
	mockWebSocket,
	startWebSocketServer
} from '../support/websocket';
import { USER_CONSULTANT } from '../support/commands/mockApi';
import { formatMatrixTimelineEvent } from '../../src/utils/matrixTimelineEventFormatter';

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
		cy.intercept(
			'GET',
			'**/service/matrix/sessions/123/messages',
			(req) => {
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
			}
		).as('matrixRestMessages');

		cy.fastLogin({ userId: USER_CONSULTANT });
		cy.get('a[href="/sessions/consultant/sessionView"]').click();
		cy.wait('@consultantSessions');
		cy.get('[data-cy=session-list-item]').first().click();
		cy.location('pathname').should(
			'contain',
			'/sessions/consultant/sessionView'
		);
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

	it('maps Matrix encrypted media events to decryptable attachment metadata', () => {
		const encryptedFile = {
			url: 'mxc://oriso.org/file',
			key: {
				alg: 'A256CTR',
				ext: true,
				k: 'secret',
				key_ops: ['encrypt', 'decrypt'],
				kty: 'oct'
			},
			iv: 'iv',
			hashes: { sha256: 'hash' },
			v: 'v2'
		};
		const event = {
			getType: () => 'm.room.message',
			getClearContent: () => ({
				msgtype: 'm.file',
				body: 'case-note.txt',
				file: encryptedFile,
				info: {
					mimetype: 'text/plain',
					size: 22
				}
			}),
			getSender: () => '@asker:oriso.org',
			getId: () => '$encrypted-file',
			getTs: () => 1782302400000
		};

		const message = formatMatrixTimelineEvent(
			event,
			{ getMember: () => ({ name: 'Asker' }) },
			'encrypted'
		);

		expect(message).to.deep.include({
			_id: '$encrypted-file',
			msg: 'case-note.txt',
			t: 'matrix-e2e-file'
		});
		expect(message.file).to.deep.equal({
			name: 'case-note.txt',
			type: 'text/plain'
		});
		expect(message.attachments[0]).to.deep.include({
			title: 'case-note.txt',
			title_link: '/_matrix/media/r0/download/oriso.org/file',
			type: 'file',
			image_type: 'text/plain',
			image_size: 22,
			matrix_encrypted_file: encryptedFile
		});
		expect(message.attachments[0]).not.to.have.property('image_url');
	});
});
