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
});
