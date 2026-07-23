import { matrixCallService } from '../../src/services/matrixCallService';

describe('Matrix native call privacy', () => {
	afterEach(() => {
		matrixCallService.destroy();
	});

	it('does not start native Matrix WebRTC calls in unencrypted rooms', () => {
		const createCall = cy.stub().returns({
			on: cy.stub(),
			placeCall: cy.stub().resolves()
		});
		const room = {
			hasEncryptionStateEvent: cy.stub().returns(false)
		};

		matrixCallService.initialize({
			createCall,
			getRoom: cy
				.stub()
				.withArgs('!plain-call-room:oriso.org')
				.returns(room),
			isRoomEncrypted: cy
				.stub()
				.withArgs('!plain-call-room:oriso.org')
				.returns(false),
			on: cy.stub(),
			removeAllListeners: cy.stub()
		} as never);

		cy.then(() =>
			matrixCallService
				.startCall({
					roomId: '!plain-call-room:oriso.org',
					isVideoCall: true
				})
				.then(
					() => {
						throw new Error(
							'Expected unencrypted Matrix call start to fail'
						);
					},
					(error) => {
						expect(error.message).to.contain(
							'encrypted Matrix room'
						);
						expect(createCall.callCount).to.equal(0);
					}
				)
		);
	});

	it('does not answer native Matrix WebRTC calls in unencrypted rooms', () => {
		const answer = cy.stub().resolves();
		const call = {
			answer,
			on: cy.stub(),
			roomId: '!plain-call-room:oriso.org'
		};
		const room = {
			hasEncryptionStateEvent: cy.stub().returns(false)
		};

		matrixCallService.initialize({
			getRoom: cy
				.stub()
				.withArgs('!plain-call-room:oriso.org')
				.returns(room),
			isRoomEncrypted: cy
				.stub()
				.withArgs('!plain-call-room:oriso.org')
				.returns(false),
			on: cy.stub(),
			removeAllListeners: cy.stub()
		} as never);

		cy.then(() =>
			matrixCallService.answerCall(call as never, true).then(
				() => {
					throw new Error(
						'Expected unencrypted Matrix call answer to fail'
					);
				},
				(error) => {
					expect(error.message).to.contain('encrypted Matrix room');
					expect(answer.callCount).to.equal(0);
				}
			)
		);
	});
});
