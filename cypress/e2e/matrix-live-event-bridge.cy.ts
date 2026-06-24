import { MatrixLiveEventBridge } from '../../src/services/matrixLiveEventBridge';

type MatrixBridgeClient = Parameters<MatrixLiveEventBridge['initialize']>[0];
type Listener = (...args: unknown[]) => void;

describe('Matrix live event bridge privacy', () => {
	it('emits Matrix message metadata without forwarding plaintext bodies', () => {
		const listeners: Record<string, Listener[]> = {};
		const fakeClient = {
			getUserId: () => '@consultant:oriso.org',
			on: (eventType: string, callback: Listener) => {
				listeners[eventType] = listeners[eventType] || [];
				listeners[eventType].push(callback);
			},
			removeAllListeners: (eventType: string) => {
				delete listeners[eventType];
			}
		};
		const bridge = new MatrixLiveEventBridge();
		const receivedEvents: Array<Record<string, unknown>> = [];

		bridge.on('directMessage', (event: Record<string, unknown>) => {
			receivedEvents.push(event);
		});
		bridge.initialize(fakeClient as unknown as MatrixBridgeClient);

		listeners['Room.timeline'][0](
			{
				getType: () => 'm.room.message',
				getSender: () => '@asker:oriso.org',
				getContent: () => ({
					msgtype: 'm.text',
					body: 'sensitive Matrix message body'
				}),
				getId: () => '$event-id',
				getTs: () => 1782302400000
			},
			{ roomId: '!room:oriso.org' },
			false
		);

		expect(receivedEvents).to.deep.equal([
			{
				roomId: '!room:oriso.org',
				sender: '@asker:oriso.org',
				isOwnMessage: false,
				msgtype: 'm.text',
				eventId: '$event-id',
				timestamp: 1782302400000
			}
		]);
		expect(receivedEvents[0]).not.to.have.property('body');

		bridge.destroy();
	});
});
