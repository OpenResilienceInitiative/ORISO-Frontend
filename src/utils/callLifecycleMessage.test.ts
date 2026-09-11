import { describe, expect, it } from 'vitest';
import {
	buildCallLifecycleContent,
	parseCallLifecycleMessage,
	collapseCallLifecycleMessages,
	applyCallLifecycleEdits,
	type CallLifecycleMessage
} from './callLifecycleMessage';

const call: CallLifecycleMessage = {
	callId: 'call-1',
	roomRef: '!conversation:example',
	callRoomId: '!media:example',
	state: 'running',
	callType: 'video',
	participants: [],
	startedAt: '2026-09-11T10:00:00Z'
};

describe('durable call lifecycle contract', () => {
	it('applies a same-sender replacement before ordinary message edits discard the revision', () => {
		const original = {
			_id: '$root',
			ts: 100,
			u: { _id: '@caller:example' },
			callLifecycle: call
		};
		const revision = {
			_id: '$edit',
			ts: 200,
			u: original.u,
			replaceTargetId: '$root',
			editedCallLifecycle: { ...call, state: 'ended' as const }
		};
		expect(applyCallLifecycleEdits([original, revision])).toEqual([
			expect.objectContaining({
				_id: '$root',
				ts: 100,
				callLifecycleRevisionTs: 200,
				callLifecycle: expect.objectContaining({ state: 'ended' })
			})
		]);
	});
	it('does not let another sender replace the call or change its media room', () => {
		const original = {
			_id: '$root',
			ts: 100,
			u: { _id: '@caller:example' },
			callLifecycle: call
		};
		const foreign = {
			_id: '$edit',
			ts: 200,
			u: { _id: '@other:example' },
			replaceTargetId: '$root',
			editedCallLifecycle: { ...call, state: 'ended' as const }
		};
		const redirected = {
			...foreign,
			_id: '$redirect',
			u: original.u,
			editedCallLifecycle: { ...call, callRoomId: '!malicious:example' }
		};
		expect(
			applyCallLifecycleEdits([original, foreign, redirected])
		).toEqual([original]);
	});
	it('keeps ordinary text edits for the existing message editing pipeline', () => {
		const textEdit = {
			_id: '$text-edit',
			ts: 100,
			replaceTargetId: '$text',
			editedBody: 'edited text'
		};
		expect(applyCallLifecycleEdits([textEdit])).toEqual([textEdit]);
	});
	it('round trips the room message wire format', () => {
		expect(
			parseCallLifecycleMessage(buildCallLifecycleContent(call))
		).toEqual(call);
	});
	it('does not interpret ordinary chat JSON as a call', () => {
		expect(parseCallLifecycleMessage({ ...call })).toBeNull();
		expect(
			parseCallLifecycleMessage({
				'msgtype': 'm.text',
				'org.oriso.call': call
			})
		).toBeNull();
	});
	it('rejects invalid timestamps and negative durations instead of crashing the renderer', () => {
		const wire = buildCallLifecycleContent(call);
		const payload = wire['org.oriso.call'] as Record<string, unknown>;
		payload.started_at = 'yesterday';
		expect(parseCallLifecycleMessage(wire)).toBeNull();
		payload.started_at = call.startedAt;
		payload.duration_seconds = -1;
		expect(parseCallLifecycleMessage(wire)).toBeNull();
	});
	it('keeps the first durable identity through three revisions', () => {
		const items = [
			{ _id: '$first', ts: 100, callLifecycle: call },
			{
				_id: '$second',
				ts: 200,
				callLifecycle: {
					...call,
					participants: [
						{ userId: '@asker:example', displayName: 'Asker' }
					]
				}
			},
			{
				_id: '$third',
				ts: 300,
				callLifecycle: { ...call, state: 'ended' as const }
			}
		];
		expect(collapseCallLifecycleMessages(items)).toEqual([
			expect.objectContaining({
				_id: '$first',
				ts: 100,
				callLifecycle: expect.objectContaining({ state: 'ended' })
			})
		]);
	});
	it('never reopens a terminal call because a delayed running event arrived', () => {
		const items = [
			{
				_id: '$first',
				ts: 100,
				callLifecycle: { ...call, state: 'ended' as const }
			},
			{ _id: '$late', ts: 300, callLifecycle: call }
		];
		expect(
			collapseCallLifecycleMessages(items)[0].callLifecycle?.state
		).toBe('ended');
	});
	it('does not let a second root hijack the original call sender or media room', () => {
		const original = {
			_id: '$first',
			ts: 100,
			u: { _id: '@caller:example' },
			callLifecycle: call
		};
		const foreign = {
			...original,
			_id: '$foreign',
			ts: 200,
			u: { _id: '@other:example' },
			callLifecycle: { ...call, state: 'ended' as const }
		};
		const redirected = {
			...original,
			_id: '$redirect',
			ts: 300,
			callLifecycle: { ...call, callRoomId: '!other-media:example' }
		};
		expect(
			collapseCallLifecycleMessages([original, foreign, redirected])
		).toEqual([original]);
	});
	it('does not collapse calls from distinct conversations with the same id', () => {
		const items = [
			{ _id: '$first', ts: 100, callLifecycle: call },
			{
				_id: '$other',
				ts: 200,
				callLifecycle: { ...call, roomRef: '!other:example' }
			}
		];
		expect(collapseCallLifecycleMessages(items)).toHaveLength(2);
	});
});
