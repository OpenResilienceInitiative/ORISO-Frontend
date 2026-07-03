import { describe, expect, it } from 'vitest';
import { resolveAsideTargetRoomId } from './asideRouting';

const CLIENT_ROOM = '!client:matrix.example.org';
const SIDE_ROOM = '!supervision:matrix.example.org';

describe('resolveAsideTargetRoomId (ADR-008 aside send routing)', () => {
	it('routes a supervisor aside to the supervision side room, not the client room', () => {
		const result = resolveAsideTargetRoomId({
			isAside: true,
			clientRoomId: CLIENT_ROOM,
			supervisionRoomId: SIDE_ROOM
		});

		// Composer with isSupervisor=true + supervisionRoomId set must target
		// the side room, never the client-facing room.
		expect(result.abort).toBe(false);
		expect(result.targetRoomId).toBe(SIDE_ROOM);
		expect(result.targetRoomId).not.toBe(CLIENT_ROOM);
	});

	it('routes an explicit VISIBLE_TO aside to the supervision side room', () => {
		const result = resolveAsideTargetRoomId({
			isAside: true,
			clientRoomId: CLIENT_ROOM,
			supervisionRoomId: SIDE_ROOM
		});

		expect(result.abort).toBe(false);
		expect(result.targetRoomId).toBe(SIDE_ROOM);
	});

	it('aborts (never falls back to the client room) when an aside has no side room', () => {
		const result = resolveAsideTargetRoomId({
			isAside: true,
			clientRoomId: CLIENT_ROOM,
			supervisionRoomId: undefined
		});

		// SAFETY: an aside with a missing side room must abort — leaking it into
		// the client room would expose the aside to the client.
		expect(result.abort).toBe(true);
		expect(result.targetRoomId).toBeNull();
		expect(result.targetRoomId).not.toBe(CLIENT_ROOM);
	});

	it('also aborts when the side room id is an empty string', () => {
		const result = resolveAsideTargetRoomId({
			isAside: true,
			clientRoomId: CLIENT_ROOM,
			supervisionRoomId: ''
		});

		expect(result.abort).toBe(true);
		expect(result.targetRoomId).toBeNull();
	});

	it('routes a normal (non-aside) message to the client room', () => {
		const result = resolveAsideTargetRoomId({
			isAside: false,
			clientRoomId: CLIENT_ROOM,
			supervisionRoomId: SIDE_ROOM
		});

		expect(result.abort).toBe(false);
		expect(result.targetRoomId).toBe(CLIENT_ROOM);
	});
});
