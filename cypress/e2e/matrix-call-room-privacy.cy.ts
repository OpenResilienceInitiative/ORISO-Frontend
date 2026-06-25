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

	it('does not send Element Call invites into unencrypted signalling rooms', () => {
		const sendEvent = cy.stub().resolves({ event_id: '$call-invite' });

		cy.stub(matrixClientService, 'getClient').returns({
			getDeviceId: cy.stub().returns('DEVICEID'),
			isRoomEncrypted: cy
				.stub()
				.withArgs('!plain-session-room:oriso.org')
				.returns(false),
			sendEvent
		} as never);

		cy.then(() =>
			(callManager as any).sendGroupCallInvite(
				'!plain-session-room:oriso.org',
				'call-123',
				true,
				'!encrypted-call-room:oriso.org',
				true
			)
		).then(() => {
			expect(sendEvent.callCount).to.equal(0);
		});
	});

	it('does not send Element Call hangups into unencrypted signalling rooms', () => {
		const sendEvent = cy.stub().resolves({ event_id: '$call-hangup' });

		cy.stub(matrixClientService, 'getClient').returns({
			isRoomEncrypted: cy
				.stub()
				.withArgs('!plain-session-room:oriso.org')
				.returns(false),
			sendEvent
		} as never);

		cy.then(() =>
			(callManager as any).sendElementCallHangup({
				callId: 'call-123',
				roomId: '!encrypted-call-room:oriso.org',
				isVideo: true,
				isIncoming: false,
				state: 'connected',
				usesElementCall: true,
				elementCallRoomId: '!encrypted-call-room:oriso.org',
				signalRoomId: '!plain-session-room:oriso.org'
			})
		).then(() => {
			expect(sendEvent.callCount).to.equal(0);
		});
	});

	it('does not update Element Call power levels in unencrypted call rooms', () => {
		const sendStateEvent = cy.stub().resolves({});

		cy.stub(matrixClientService, 'getClient').returns({
			getRoom: cy
				.stub()
				.withArgs('!plain-call-room:oriso.org')
				.returns({
					currentState: {
						getStateEvents: cy.stub().returns({
							getContent: cy.stub().returns({
								events: {
									'org.matrix.msc3401.call.member': 50
								},
								state_default: 50,
								events_default: 0
							})
						})
					}
				}),
			isRoomEncrypted: cy
				.stub()
				.withArgs('!plain-call-room:oriso.org')
				.returns(false),
			sendStateEvent
		} as never);

		cy.then(() =>
			(callManager as any).ensureGroupCallPermissions(
				'!plain-call-room:oriso.org'
			)
		).then(() => {
			expect(sendStateEvent.callCount).to.equal(0);
		});
	});
});
