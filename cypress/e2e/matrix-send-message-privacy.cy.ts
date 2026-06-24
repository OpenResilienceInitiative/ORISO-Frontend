import { apiSendMessage } from '../../src/api/apiSendMessage';
import { matrixClientService } from '../../src/services/matrixClientService';

describe('Matrix send message privacy', () => {
	it('does not send Matrix plaintext through the REST proxy when the SDK client is unavailable', () => {
		const restPayloads: unknown[] = [];
		cy.stub(matrixClientService, 'getClient').returns(null);
		cy.intercept('POST', '**/service/matrix/sessions/123/messages', (req) => {
			restPayloads.push(req.body);
			req.reply({ statusCode: 201, body: { ok: true } });
		}).as('matrixRestSend');

		cy.then(() =>
			apiSendMessage(
				'sensitive Matrix message body',
				123,
				true,
				false,
				123,
				'!secure-room:oriso.org'
			).then(
				() => {
					throw new Error(
						'Expected Matrix send without SDK client to fail'
					);
				},
				(error) => {
					expect(error.message).to.contain('Matrix client');
				}
			)
		);

		cy.then(() => {
			expect(restPayloads).to.deep.equal([]);
		});
	});

	it('does not retry failed Matrix SDK sends through the REST proxy with plaintext', () => {
		const restPayloads: unknown[] = [];
		cy.stub(matrixClientService, 'getClient').returns({} as never);
		cy.stub(matrixClientService, 'sendMessage').rejects(
			new Error('SDK send failed')
		);
		cy.intercept('POST', '**/service/matrix/sessions/123/messages', (req) => {
			restPayloads.push(req.body);
			req.reply({ statusCode: 201, body: { ok: true } });
		}).as('matrixRestSend');

		cy.then(() =>
			apiSendMessage(
				'sensitive Matrix message body',
				123,
				true,
				false,
				123,
				'!secure-room:oriso.org'
			).then(
				() => {
					throw new Error(
						'Expected failed Matrix SDK send to stay failed'
					);
				},
				(error) => {
					expect(error.message).to.equal('SDK send failed');
				}
			)
		);

		cy.then(() => {
			expect(restPayloads).to.deep.equal([]);
		});
	});

	it('uploads Matrix attachments through the SDK and sends a Matrix media event', () => {
		const service = matrixClientService as any;
		const uploadContent = cy
			.stub()
			.callsFake((_file: File, options: any) => {
				options.progressHandler({ loaded: 5, total: 10 });
				return Promise.resolve({ content_uri: 'mxc://oriso.org/file' });
			});
		const sendMessage = cy
			.stub()
			.resolves({ event_id: '$file-message' });
		const progressUpdates: number[] = [];
		const file = new File(['sensitive attachment'], 'case-note.txt', {
			type: 'text/plain'
		});

		cy.stub(service, 'ensureFreshToken').resolves();
		service.client = { uploadContent, sendMessage };

		cy.then(() =>
			matrixClientService.sendFileMessage('!secure-room:oriso.org', file, {
				uploadProgress: (percentUpload) =>
					progressUpdates.push(percentUpload)
			})
		).then(() => {
			expect(uploadContent).to.have.been.calledOnce;
			expect(sendMessage).to.have.been.calledOnceWith(
				'!secure-room:oriso.org',
				Cypress.sinon.match({
					body: 'case-note.txt',
					filename: 'case-note.txt',
					msgtype: 'm.file',
					url: 'mxc://oriso.org/file',
					info: {
						mimetype: 'text/plain',
						size: file.size
					}
				})
			);
			expect(progressUpdates).to.deep.equal([50, 100]);
			service.client = null;
		});
	});

	it('keeps Matrix attachment submitters off the REST upload helper', () => {
		cy.readFile(
			'src/components/messageSubmitInterface/messageSubmitInterfaceComponent.tsx'
		).should('not.contain', 'apiMatrixUploadFile');
	});
});
