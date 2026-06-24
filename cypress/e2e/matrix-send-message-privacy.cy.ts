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

	it('refuses to send Matrix text messages to rooms without encryption state', () => {
		const service = matrixClientService as any;
		const sendMessage = cy.stub().resolves({ event_id: '$plaintext' });

		cy.stub(service, 'ensureFreshToken').resolves();
		service.client = {
			isRoomEncrypted: cy
				.stub()
				.withArgs('!plain-room:oriso.org')
				.returns(false),
			sendMessage
		};

		cy.then(() =>
			matrixClientService.sendMessage(
				'!plain-room:oriso.org',
				'sensitive Matrix message body'
			).then(
				() => {
					throw new Error(
						'Expected unencrypted Matrix room send to fail'
					);
				},
				(error) => {
					expect(error.message).to.contain(
						'encrypted Matrix room'
					);
					expect(sendMessage.callCount).to.equal(0);
					service.client = null;
				}
			)
		);
	});

	it('refuses to upload Matrix attachments before room encryption is verified', () => {
		const service = matrixClientService as any;
		const uploadContent = cy
			.stub()
			.resolves({ content_uri: 'mxc://oriso.org/plain-file' });
		const sendMessage = cy.stub().resolves({ event_id: '$plain-file' });
		const file = new File(['sensitive attachment'], 'case-note.txt', {
			type: 'text/plain'
		});

		cy.stub(service, 'ensureFreshToken').resolves();
		service.client = {
			isRoomEncrypted: cy
				.stub()
				.withArgs('!plain-room:oriso.org')
				.returns(false),
			uploadContent,
			sendMessage
		};

		cy.then(() =>
			matrixClientService
				.sendFileMessage('!plain-room:oriso.org', file)
				.then(
					() => {
						throw new Error(
							'Expected unencrypted Matrix attachment send to fail'
						);
					},
					(error) => {
						expect(error.message).to.contain(
							'encrypted Matrix room'
						);
						expect(uploadContent.callCount).to.equal(0);
						expect(sendMessage.callCount).to.equal(0);
						service.client = null;
					}
				)
		);
	});

	it('uploads Matrix attachments as encrypted media through the SDK', () => {
		const service = matrixClientService as any;
		let uploadedPayload: XMLHttpRequestBodyInit | undefined;
		let uploadOptions: any;
		const uploadContent = cy
			.stub()
			.callsFake(async (payload: XMLHttpRequestBodyInit, options: any) => {
				uploadedPayload = payload;
				uploadOptions = options;
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
		service.client = {
			isRoomEncrypted: cy
				.stub()
				.withArgs('!secure-room:oriso.org')
				.returns(true),
			uploadContent,
			sendMessage
		};

		cy.then(() =>
			matrixClientService.sendFileMessage('!secure-room:oriso.org', file, {
				uploadProgress: (percentUpload) =>
					progressUpdates.push(percentUpload)
			})
		).then(() => {
			expect(uploadContent).to.have.callCount(1);
			expect(uploadedPayload).not.to.equal(file);
			expect(uploadOptions.includeFilename).to.equal(false);
			expect(uploadOptions.type).to.equal('application/octet-stream');
			expect(sendMessage).to.have.been.calledOnceWith(
				'!secure-room:oriso.org',
				Cypress.sinon.match((content) => {
					expect(content).to.deep.include({
						body: 'case-note.txt',
						filename: 'case-note.txt',
						msgtype: 'm.file'
					});
					expect(content).not.to.have.property('url');
					expect(content.file).to.deep.include({
						url: 'mxc://oriso.org/file',
						v: 'v2'
					});
					expect(content.file.key).to.deep.include({
						alg: 'A256CTR',
						ext: true,
						kty: 'oct'
					});
					expect(content.file.hashes.sha256).to.be.a('string');
					expect(content.file.iv).to.be.a('string');
					expect(content.info).to.deep.equal({
						mimetype: 'text/plain',
						size: file.size
					});
					return true;
				})
			);
			cy.wrap(uploadedPayload)
				.should('be.instanceOf', Blob)
				.then(async (payload) => {
					const encryptedBody = await (payload as Blob).text();
					expect(encryptedBody).not.to.equal('sensitive attachment');
				});
			expect(progressUpdates).to.deep.equal([50, 100]);
			service.client = null;
		});
	});

	it('can decrypt Matrix encrypted media payloads created by the upload helper', () => {
		const service = matrixClientService as any;
		let uploadedPayload: XMLHttpRequestBodyInit | undefined;
		let sentContent: any;
		const file = new File(['recoverable attachment'], 'case-note.txt', {
			type: 'text/plain'
		});
		const uploadContent = cy
			.stub()
			.callsFake(async (payload: XMLHttpRequestBodyInit) => {
				uploadedPayload = payload;
				return Promise.resolve({ content_uri: 'mxc://oriso.org/file' });
			});
		const sendMessage = cy.stub().callsFake((_roomId, content) => {
			sentContent = content;
			return Promise.resolve({ event_id: '$file-message' });
		});

		cy.stub(service, 'ensureFreshToken').resolves();
		service.client = {
			isRoomEncrypted: cy
				.stub()
				.withArgs('!secure-room:oriso.org')
				.returns(true),
			uploadContent,
			sendMessage
		};

		cy.then(() =>
			matrixClientService.sendFileMessage('!secure-room:oriso.org', file)
		).then(async () => {
			const { decryptMatrixAttachment } = await import(
				'../../src/utils/matrixEncryptedAttachment'
			);
			const decrypted = await decryptMatrixAttachment(
				await (uploadedPayload as Blob).arrayBuffer(),
				sentContent.file
			);
			expect(await new Blob([decrypted]).text()).to.equal(
				'recoverable attachment'
			);
			service.client = null;
		});
	});

	it('keeps Matrix attachment submitters off the REST upload helper', () => {
		cy.readFile(
			'src/components/messageSubmitInterface/messageSubmitInterfaceComponent.tsx'
		).should('not.contain', 'apiMatrixUploadFile');
	});
});
