import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CallTimelineMessageService } from './callTimelineMessageService';
import { parseCallLifecycleMessage } from '../utils/callLifecycleMessage';

const { sendMessage, client } = vi.hoisted(() => {
	const send = vi.fn();
	return {
		sendMessage: send,
		client: {
			getUserId: () => '@bart:oriso.example',
			getRoom: vi.fn(),
			sendMessage: send
		}
	};
});

vi.mock('./matrixClientRegistry', () => ({
	getMatrixClientService: () => ({ getClient: () => client })
}));

describe('CallTimelineMessageService', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		sendMessage.mockResolvedValue({ event_id: '$started' });
	});

	it('writes one running message and resolves it with m.replace', async () => {
		const service = new CallTimelineMessageService();
		const call = {
			callId: 'call-1',
			roomRef: '!conversation:oriso.example',
			callRoomId: '!call:oriso.example',
			isVideo: true
		};

		await service.announceStarted(call);
		await service.finish(call, 'ended');

		expect(sendMessage).toHaveBeenCalledTimes(2);
		expect(sendMessage.mock.calls[1][1]['m.relates_to']).toEqual({
			rel_type: 'm.replace',
			event_id: '$started'
		});
		expect(
			parseCallLifecycleMessage(
				sendMessage.mock.calls[1][1]['m.new_content']
			)
		).toMatchObject({
			callId: 'call-1',
			state: 'ended',
			callType: 'video'
		});
	});
});
