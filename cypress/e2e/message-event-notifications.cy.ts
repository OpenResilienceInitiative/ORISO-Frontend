import { buildMessageEventNotificationBody } from '../../src/api/apiPostMessageEventNotification';

describe('Message event notification privacy', () => {
	it('strips plaintext previews from Matrix notification payloads', () => {
		const payload = buildMessageEventNotificationBody({
			roomId: '!matrix-room:oriso.org',
			matrixRoom: true,
			messagePreview: 'highly sensitive Matrix message body',
			threadRootId: '$thread-root',
			threadParentPreview: 'sensitive parent message',
			supervisorMessage: true,
			senderDisplayName: 'Counsellor'
		});

		expect(payload).to.deep.equal({
			roomId: '!matrix-room:oriso.org',
			messagePreview: '',
			matrixRoom: true,
			threadRootId: '$thread-root',
			supervisorMessage: true,
			senderDisplayName: 'Counsellor',
			threadParentPreview: null
		});
		expect(JSON.stringify(payload)).not.to.contain(
			'highly sensitive Matrix message body'
		);
		expect(JSON.stringify(payload)).not.to.contain(
			'sensitive parent message'
		);
	});

	it('defaults to Matrix-safe payloads when the room type is not provided', () => {
		const payload = buildMessageEventNotificationBody({
			roomId: '!matrix-room:oriso.org',
			messagePreview: 'implicit Matrix plaintext'
		});

		expect(payload.matrixRoom).to.equal(true);
		expect(payload.messagePreview).to.equal('');
	});

	it('keeps bounded previews only for explicit non-Matrix legacy payloads', () => {
		const longPreview = 'legacy Rocket.Chat message '.repeat(8);
		const payload = buildMessageEventNotificationBody({
			roomId: 'legacy-room',
			matrixRoom: false,
			messagePreview: longPreview,
			threadParentPreview: 'legacy parent'
		});

		expect(payload.messagePreview).to.equal(longPreview.slice(0, 100));
		expect(payload.threadParentPreview).to.equal('legacy parent');
	});
});
