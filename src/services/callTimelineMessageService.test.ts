import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MatrixRTCSession } from 'matrix-js-sdk/lib/matrixrtc/MatrixRTCSession';
import { CallTimelineMessageService } from './callTimelineMessageService';
import { parseCallLifecycleMessage } from '../utils/callLifecycleMessage';

const { sendMessage, client } = vi.hoisted(() => {
	const send = vi.fn();
	return {
		sendMessage: send,
		client: {
			getUserId: () => '@bart:oriso.example',
			getUser: (userId: string) => ({
				displayName:
					userId === '@lisa:oriso.example'
						? 'Lisa Simpson'
						: undefined
			}),
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
		client.getRoom.mockReturnValue(null);
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

	it('persists MatrixRTC attendance in running and ended replacements', async () => {
		const room = { roomId: '!call:oriso.example' };
		client.getRoom.mockReturnValue(room);
		const memberships = vi
			.spyOn(MatrixRTCSession, 'sessionMembershipsForRoom')
			.mockReturnValue([
				{ sender: '@bart:oriso.example' },
				{ sender: '@lisa:oriso.example' }
			] as any);
		const service = new CallTimelineMessageService();
		const call = {
			callId: 'call-with-attendance',
			roomRef: '!conversation:oriso.example',
			callRoomId: '!call:oriso.example',
			isVideo: false
		};

		await service.announceStarted(call);
		memberships.mockReturnValue([{ sender: '@lisa:oriso.example' }] as any);
		await service.finish(call, 'ended');

		const started = parseCallLifecycleMessage(sendMessage.mock.calls[0][1]);
		const ended = parseCallLifecycleMessage(
			sendMessage.mock.calls[1][1]['m.new_content']
		);
		expect(started?.participants.map(({ userId }) => userId)).toEqual([
			'@bart:oriso.example',
			'@lisa:oriso.example'
		]);
		expect(ended?.participants).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					userId: '@lisa:oriso.example',
					displayName: 'Lisa Simpson'
				}),
				expect.objectContaining({ userId: '@bart:oriso.example' })
			])
		);
		expect(ended?.participantCount).toBe(2);
	});
});
