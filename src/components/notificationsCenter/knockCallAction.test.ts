import { describe, expect, it, vi } from 'vite-plus/test';
import { enterKnockCall } from './knockCallAction';
import type { EventActionTarget } from './eventDescriptors/types';

/**
 * FE#1952 (Frank, 2026-10-30): the person is already waiting, so one click on
 * the knock entry takes the counsellor into the call of that conversation,
 * where the knock notice lets them in. The click goes through the same
 * `startRoomCall` the conversation's own call button uses.
 */
const knock = (
	overrides: Partial<Extract<EventActionTarget, { kind: 'callRoom' }>> = {}
): EventActionTarget => ({
	kind: 'callRoom',
	roomId: '!direct:matrix.example',
	isVideo: true,
	path: '/sessions/consultant/sessionView/!direct:matrix.example/500',
	...overrides
});

describe('enterKnockCall (FE#1952)', () => {
	it('starts the call in the conversation like its call button does', () => {
		const start = vi.fn().mockResolvedValue(undefined);

		expect(
			enterKnockCall(knock(), { start, currentCall: () => null })
		).toBe(true);

		expect(start).toHaveBeenCalledTimes(1);
		expect(start).toHaveBeenCalledWith({
			roomId: '!direct:matrix.example',
			isVideo: true,
			isGroup: false
		});
	});

	it('starts an audio call for an audio knock', () => {
		const start = vi.fn().mockResolvedValue(undefined);

		enterKnockCall(knock({ isVideo: false }), {
			start,
			currentCall: () => null
		});

		expect(start).toHaveBeenCalledWith(
			expect.objectContaining({ isVideo: false })
		);
	});

	it('does not start a second call when the counsellor is already in this one', () => {
		const start = vi.fn();

		expect(
			enterKnockCall(knock(), {
				start,
				currentCall: () => ({
					roomId: '!element-call:matrix.example',
					signalRoomId: '!direct:matrix.example',
					state: 'connected'
				})
			})
		).toBe(true);

		expect(start).not.toHaveBeenCalled();
	});

	it('starts again when the last call in this conversation was left', () => {
		const start = vi.fn().mockResolvedValue(undefined);

		enterKnockCall(knock(), {
			start,
			currentCall: () => ({
				roomId: '!element-call:matrix.example',
				signalRoomId: '!direct:matrix.example',
				state: 'left'
			})
		});

		expect(start).toHaveBeenCalledTimes(1);
	});

	it('never ends a call the counsellor is in elsewhere: the conversation opens instead', () => {
		const start = vi.fn();

		expect(
			enterKnockCall(knock(), {
				start,
				currentCall: () => ({
					roomId: '!other-call:matrix.example',
					signalRoomId: '!other:matrix.example',
					state: 'connected'
				})
			})
		).toBe(false);

		expect(start).not.toHaveBeenCalled();
	});

	it('leaves every other entry and a knock without a room to the conversation path', () => {
		const start = vi.fn();
		const deps = { start, currentCall: () => null };

		expect(enterKnockCall(knock({ roomId: null }), deps)).toBe(false);
		expect(enterKnockCall({ kind: 'conversation', path: '/x' }, deps)).toBe(
			false
		);
		expect(
			enterKnockCall(
				{ kind: 'join', callRoomId: '!a', isVideo: true },
				deps
			)
		).toBe(false);
		expect(start).not.toHaveBeenCalled();
	});
});
