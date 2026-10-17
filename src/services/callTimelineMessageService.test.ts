import { describe, expect, it, vi } from 'vitest';
import { CallTimelineMessageService } from './callTimelineMessageService';
import {
	type CallLifecycleMessage,
	parseCallLifecycleMessage
} from '../utils/callLifecycleMessage';

const call: CallLifecycleMessage = {
	callId: 'call-1',
	roomRef: '!conversation:example',
	callRoomId: '!media:example',
	state: 'running',
	callType: 'video',
	participants: []
};

describe('encrypted call timeline writes', () => {
	it('serializes running and terminal writes as one durable event plus an edit', async () => {
		const sendMessage = vi.fn().mockResolvedValue({ event_id: '$root' });
		const service = new CallTimelineMessageService(() => ({ sendMessage }));
		await Promise.all([
			service.publish(call),
			service.publish({ ...call, state: 'ended' })
		]);
		expect(sendMessage).toHaveBeenCalledTimes(2);
		expect(sendMessage.mock.calls[0][0]).toBe(call.roomRef);
		expect(sendMessage.mock.calls[1][1]['m.relates_to']).toEqual({
			rel_type: 'm.replace',
			event_id: '$root'
		});
		expect(
			parseCallLifecycleMessage(sendMessage.mock.calls[1][1])?.state
		).toBe('ended');
	});
	it('does not resurrect a terminal call when the Matrix client returns', async () => {
		const sendMessage = vi.fn().mockResolvedValue({ event_id: '$root' });
		let connected = false;
		const service = new CallTimelineMessageService(() =>
			connected ? { sendMessage } : null
		);
		await expect(
			service.publish({ ...call, state: 'ended' })
		).rejects.toThrow(/Matrix client/);
		connected = true;
		await service.publish(call);
		expect(sendMessage).not.toHaveBeenCalled();
		await service.publish({ ...call, state: 'ended' });
		expect(sendMessage).toHaveBeenCalledTimes(1);
	});
	it('retains a failed terminal update for an explicit retry without reopening the call', async () => {
		const sendMessage = vi
			.fn()
			.mockResolvedValueOnce({ event_id: '$root' })
			.mockRejectedValueOnce(new Error('offline'))
			.mockResolvedValue({ event_id: '$edit' });
		const service = new CallTimelineMessageService(() => ({ sendMessage }));
		await service.publish(call);
		await expect(
			service.publish({ ...call, state: 'ended' })
		).rejects.toThrow('offline');
		await service.publish(call);
		await service.publish({ ...call, state: 'ended' });
		expect(sendMessage).toHaveBeenCalledTimes(3);
		expect(sendMessage.mock.calls[2][1]['m.relates_to'].event_id).toBe(
			'$root'
		);
		// Under the SAME transaction ID, which is the whole point of keeping
		// one: the server stores the terminal edit once however many times
		// this client has to ask.
		expect(sendMessage.mock.calls[1][2]).toBe(sendMessage.mock.calls[2][2]);
	});
	it('gives a rejoin its own transaction ID', async () => {
		/*
		 * A content signature comes back. A and B are present, B leaves, B
		 * rejoins — and the two-person revision is byte-for-byte the one
		 * already sent. Reusing its transaction ID made the rejoin vanish:
		 * Matrix treats a repeated ID from the same access token as
		 * idempotent, returns the earlier event ID and stores nothing, so the
		 * card went on showing A alone while this client recorded the write
		 * as done.
		 */
		const sendMessage = vi.fn().mockResolvedValue({ event_id: '$root' });
		const service = new CallTimelineMessageService(() => ({ sendMessage }));
		const a = { userId: '@asker:example', displayName: 'Asker' };
		const b = { userId: '@berater:example', displayName: 'Berater' };
		const both = { ...call, participants: [a, b], present: [a, b] };
		const alone = { ...call, participants: [a, b], present: [a] };

		await service.publish(both);
		await service.publish(alone);
		await service.publish(both);

		expect(sendMessage).toHaveBeenCalledTimes(3);
		const ids = sendMessage.mock.calls.map((callArgs) => callArgs[2]);
		expect(new Set(ids).size).toBe(3);
	});
	it('coalesces identical updates without losing a later participant update', async () => {
		const sendMessage = vi.fn().mockResolvedValue({ event_id: '$root' });
		const service = new CallTimelineMessageService(() => ({ sendMessage }));
		await Promise.all([service.publish(call), service.publish(call)]);
		await service.publish({
			...call,
			participants: [{ userId: '@asker:example', displayName: 'Asker' }]
		});
		expect(sendMessage).toHaveBeenCalledTimes(2);
	});
});
