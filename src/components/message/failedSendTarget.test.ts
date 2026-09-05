import { describe, expect, it } from 'vitest';
import { failedSendBelongsTo } from './failedSendTarget';

/**
 * Review B2 D-2: a send that fails in the supervision side room must surface
 * in the side room (card + retry), never in the client chat or a thread —
 * and a retry must be routed back to the composer that owns that room.
 */
const SIDE_ROOM = '!side:pre-dev.dreambau.com';
const ROOT = '$root:pre-dev.dreambau.com';

describe('failedSendBelongsTo', () => {
	it('a main-chat failure belongs to the main timeline only', () => {
		const failed = { threadRootId: null, targetRoomId: null };
		expect(failedSendBelongsTo(failed, { kind: 'main' })).toBe(true);
		expect(
			failedSendBelongsTo(failed, { kind: 'thread', rootId: ROOT })
		).toBe(false);
		expect(
			failedSendBelongsTo(failed, { kind: 'room', roomId: SIDE_ROOM })
		).toBe(false);
	});

	it('a thread failure belongs to its thread only', () => {
		const failed = { threadRootId: ROOT };
		expect(failedSendBelongsTo(failed, { kind: 'main' })).toBe(false);
		expect(
			failedSendBelongsTo(failed, { kind: 'thread', rootId: ROOT })
		).toBe(true);
		expect(
			failedSendBelongsTo(failed, { kind: 'thread', rootId: '$other' })
		).toBe(false);
		expect(
			failedSendBelongsTo(failed, { kind: 'room', roomId: SIDE_ROOM })
		).toBe(false);
	});

	it('a side-room failure belongs to that room only — never to the client chat', () => {
		const failed = { targetRoomId: SIDE_ROOM };
		expect(failedSendBelongsTo(failed, { kind: 'main' })).toBe(false);
		expect(
			failedSendBelongsTo(failed, { kind: 'thread', rootId: ROOT })
		).toBe(false);
		expect(
			failedSendBelongsTo(failed, { kind: 'room', roomId: SIDE_ROOM })
		).toBe(true);
		expect(
			failedSendBelongsTo(failed, { kind: 'room', roomId: '!other' })
		).toBe(false);
	});

	it('an undefined target reads as the main room (legacy entries)', () => {
		expect(failedSendBelongsTo({}, { kind: 'main' })).toBe(true);
		expect(
			failedSendBelongsTo({}, { kind: 'room', roomId: SIDE_ROOM })
		).toBe(false);
	});
});
