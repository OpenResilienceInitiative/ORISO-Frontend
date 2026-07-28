import { matrixGroupCallService } from '../../src/services/matrixGroupCallService';

describe('Matrix group call privacy', () => {
	afterEach(() => {
		return matrixGroupCallService.endGroupCall();
	});

	it('does not prepare, create, or enter GroupCalls in unencrypted rooms', () => {
		const waitUntilRoomReadyForGroupCalls = cy.stub().resolves();
		const enter = cy.stub().resolves();
		const createGroupCall = cy.stub().resolves({
			enter,
			leave: cy.stub().resolves(),
			on: cy.stub(),
			removeAllListeners: cy.stub(),
			setLocalVideoMuted: cy.stub().resolves(),
			setMicrophoneMuted: cy.stub().resolves(),
			state: 'created'
		});
		const room = {
			hasEncryptionStateEvent: cy.stub().returns(false)
		};

		matrixGroupCallService.initialize({
			createGroupCall,
			getGroupCallForRoom: cy.stub().returns(null),
			getRoom: cy
				.stub()
				.withArgs('!plain-group-room:oriso.org')
				.returns(room),
			getUser: cy.stub(),
			isRoomEncrypted: cy
				.stub()
				.withArgs('!plain-group-room:oriso.org')
				.returns(false),
			waitUntilRoomReadyForGroupCalls
		} as never);

		cy.then(() =>
			matrixGroupCallService
				.startOrJoinGroupCall(
					'!plain-group-room:oriso.org',
					true,
					cy.stub(),
					cy.stub()
				)
				.then(
					() => {
						throw new Error(
							'Expected unencrypted Matrix GroupCall start to fail'
						);
					},
					(error) => {
						expect(error.message).to.contain(
							'encrypted Matrix room'
						);
						expect(
							waitUntilRoomReadyForGroupCalls.callCount
						).to.equal(0);
						expect(createGroupCall.callCount).to.equal(0);
						expect(enter.callCount).to.equal(0);
					}
				)
		);
	});

	it('still creates and enters GroupCalls when the room is encrypted', () => {
		const waitUntilRoomReadyForGroupCalls = cy.stub().resolves();
		const enter = cy.stub().resolves();
		const setLocalVideoMuted = cy.stub().resolves();
		const setMicrophoneMuted = cy.stub().resolves();
		const createGroupCall = cy.stub().resolves({
			enter,
			leave: cy.stub().resolves(),
			on: cy.stub(),
			removeAllListeners: cy.stub(),
			setLocalVideoMuted,
			setMicrophoneMuted,
			state: 'created'
		});
		const room = {
			hasEncryptionStateEvent: cy.stub().returns(true)
		};

		matrixGroupCallService.initialize({
			createGroupCall,
			getGroupCallForRoom: cy.stub().returns(null),
			getRoom: cy
				.stub()
				.withArgs('!encrypted-group-room:oriso.org')
				.returns(room),
			getUser: cy.stub(),
			isRoomEncrypted: cy
				.stub()
				.withArgs('!encrypted-group-room:oriso.org')
				.returns(true),
			waitUntilRoomReadyForGroupCalls
		} as never);

		cy.then(() =>
			matrixGroupCallService.startOrJoinGroupCall(
				'!encrypted-group-room:oriso.org',
				true,
				cy.stub(),
				cy.stub()
			)
		).then(() => {
			expect(waitUntilRoomReadyForGroupCalls).to.have.been.calledOnceWith(
				'!encrypted-group-room:oriso.org'
			);
			expect(createGroupCall.callCount).to.equal(1);
			expect(enter.callCount).to.equal(1);
			expect(setLocalVideoMuted).to.have.been.calledOnceWith(false);
			expect(setMicrophoneMuted).to.have.been.calledOnceWith(false);
		});
	});
});
