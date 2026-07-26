/**
 * Access rules for the dedicated Element Call room.
 *
 * The call room is created per call and is separate from the counselling
 * session room, so its join rule is the only thing standing between a call and
 * anyone who has seen its room id.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { callManager } from './CallManager';
import { setMatrixClientServiceRef } from './matrixClientRegistry';

const SESSION_ROOM = '!counselling:oriso.example';
const CALL_ROOM = '!call:oriso.example';
const OWN_USER = '@counsellor:oriso.example';

type CreateRoomOptions = {
	preset?: string;
	visibility?: string;
	initial_state?: { type: string; content: Record<string, unknown> }[];
};

const stateContent = (
	options: CreateRoomOptions,
	type: string
): Record<string, unknown> | undefined =>
	options.initial_state?.find((event) => event.type === type)?.content;

const installClient = (client: Record<string, unknown>): void => {
	setMatrixClientServiceRef({
		getClient: () => client
	} as never);
};

const createCallRoom = (sourceRoomId = SESSION_ROOM): Promise<string> =>
	(
		callManager as unknown as {
			createElementCallRoom: (roomId: string) => Promise<string>;
		}
	).createElementCallRoom(sourceRoomId);

describe('createElementCallRoom', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.spyOn(console, 'warn').mockImplementation(() => undefined);
	});

	it('restricts the call to members of the counselling session', async () => {
		const createRoom = vi.fn().mockResolvedValue({ room_id: CALL_ROOM });
		installClient({
			createRoom,
			getUserId: () => OWN_USER,
			getRoom: () => null,
			invite: vi.fn()
		});

		await expect(createCallRoom()).resolves.toBe(CALL_ROOM);

		const options = createRoom.mock.calls[0][0] as CreateRoomOptions;
		// `public_chat` used to be used here, which sets `join_rule: public` —
		// anyone who learned the room id could join a counselling call.
		expect(options.preset).not.toBe('public_chat');
		expect(options.visibility).toBe('private');
		expect(stateContent(options, 'm.room.join_rules')).toEqual({
			join_rule: 'restricted',
			allow: [{ type: 'm.room_membership', room_id: SESSION_ROOM }]
		});
	});

	it('creates the call room encrypted, with history closed to non-members', async () => {
		const createRoom = vi.fn().mockResolvedValue({ room_id: CALL_ROOM });
		installClient({
			createRoom,
			getUserId: () => OWN_USER,
			getRoom: () => null,
			invite: vi.fn()
		});

		await createCallRoom();

		const options = createRoom.mock.calls[0][0] as CreateRoomOptions;
		expect(stateContent(options, 'm.room.encryption')).toBeDefined();
		expect(stateContent(options, 'm.room.history_visibility')).toEqual({
			history_visibility: 'joined'
		});
		expect(stateContent(options, 'm.room.guest_access')).toEqual({
			guest_access: 'forbidden'
		});
	});

	it('does not let a call participant reopen the room to the public', async () => {
		// The restricted join rule is worthless if any joined participant can
		// overwrite it. `state_default: 0` allowed exactly that.
		const createRoom = vi.fn().mockResolvedValue({ room_id: CALL_ROOM });
		installClient({
			createRoom,
			getUserId: () => OWN_USER,
			getRoom: () => null,
			invite: vi.fn()
		});

		await createCallRoom();

		const levels = (createRoom.mock.calls[0][0] as any)
			.power_level_content_override;
		expect(levels.state_default).toBeGreaterThanOrEqual(100);
		expect(levels.events['m.room.join_rules']).toBe(100);
		expect(levels.events['m.room.guest_access']).toBe(100);
		expect(levels.events['m.room.history_visibility']).toBe(100);
		expect(levels.events['m.room.encryption']).toBe(100);
		// The one exception: Element Call must publish call membership.
		expect(levels.events['org.matrix.msc3401.call.member']).toBe(0);
	});

	it('falls back to invites — never to a public room — on an old homeserver', async () => {
		const createRoom = vi
			.fn()
			.mockRejectedValueOnce(new Error('M_UNSUPPORTED_ROOM_VERSION'))
			.mockResolvedValueOnce({ room_id: CALL_ROOM });
		const invite = vi.fn().mockResolvedValue(undefined);
		installClient({
			createRoom,
			invite,
			getUserId: () => OWN_USER,
			getRoom: () => ({
				getMembersWithMembership: () => [
					{ userId: OWN_USER },
					{ userId: '@asker:oriso.example' }
				]
			})
		});

		await expect(createCallRoom()).resolves.toBe(CALL_ROOM);

		const fallback = createRoom.mock.calls[1][0] as CreateRoomOptions;
		expect(fallback.preset).toBe('private_chat');
		expect(stateContent(fallback, 'm.room.join_rules')).toBeUndefined();
		// The asker is invited; we do not invite ourselves.
		expect(invite).toHaveBeenCalledTimes(1);
		expect(invite).toHaveBeenCalledWith(CALL_ROOM, '@asker:oriso.example');
	});

	it('still returns the room when a single invite fails', async () => {
		const createRoom = vi
			.fn()
			.mockRejectedValueOnce(new Error('nope'))
			.mockResolvedValueOnce({ room_id: CALL_ROOM });
		installClient({
			createRoom,
			invite: vi.fn().mockRejectedValue(new Error('M_FORBIDDEN')),
			getUserId: () => OWN_USER,
			getRoom: () => ({
				getMembersWithMembership: () => [
					{ userId: '@asker:oriso.example' }
				]
			})
		});

		await expect(createCallRoom()).resolves.toBe(CALL_ROOM);
	});
});
