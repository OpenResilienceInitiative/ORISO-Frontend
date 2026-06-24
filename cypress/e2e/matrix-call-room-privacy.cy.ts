import { callManager } from '../../src/services/CallManager';
import { matrixClientService } from '../../src/services/matrixClientService';

describe('Matrix call room privacy', () => {
	it('creates dedicated Element Call rooms with encryption enabled from the initial state', () => {
		const createRoom = cy
			.stub()
			.resolves({ room_id: '!element-call-room:oriso.org' });
		const getUserId = cy.stub().returns('@consultant:oriso.org');

		cy.stub(matrixClientService, 'getClient').returns({
			createRoom,
			getUserId
		} as never);

		cy.then(() =>
			(callManager as any).createElementCallRoom(
				'!session-room:oriso.org'
			)
		).then((roomId) => {
			expect(roomId).to.equal('!element-call-room:oriso.org');
			expect(createRoom).to.have.been.calledOnceWith(
				Cypress.sinon.match((options) => {
					expect(options).to.deep.include({
						visibility: 'private',
						preset: 'public_chat',
						name: 'Group call for !session-room:oriso.org'
					});
					expect(options.initial_state).to.deep.include({
						type: 'm.room.encryption',
						state_key: '',
						content: {
							algorithm: 'm.megolm.v1.aes-sha2'
						}
					});
					expect(
						options.power_level_content_override.events[
							'org.matrix.msc3401.call.member'
						]
					).to.equal(0);
					return true;
				})
			);
		});
	});
});
