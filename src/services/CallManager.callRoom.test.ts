/**
 * Access rules for the dedicated Element Call room.
 *
 * The call room is created per call and is separate from the counselling
 * session room, so its join rule is the only thing standing between a call and
 * anyone who has seen its room id.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { callManager } from './CallManager';
import { setMatrixClientServiceRef } from './matrixClientRegistry';
import { CALL_IDENTITY_EVENT_TYPE } from '../components/call/callIdentity';

const SESSION_ROOM = '!counselling:oriso.example';
const CALL_ROOM = '!call:oriso.example';
const OWN_USER = '@counsellor:oriso.example';
const MEMBERSHIP_READER = '@matrixrtc-auth:oriso.example';

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
			createElementCallRoom: (
				roomId: string,
				callId: string
			) => Promise<string>;
		}
	).createElementCallRoom(sourceRoomId, 'test-call');

describe('createElementCallRoom', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		vi.stubEnv(
			'REACT_APP_MATRIXRTC_MEMBERSHIP_READER_USER_ID',
			MEMBERSHIP_READER
		);
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it('restricts the call to members of the counselling session', async () => {
		const createRoom = vi.fn().mockResolvedValue({ room_id: CALL_ROOM });
		const invite = vi.fn().mockResolvedValue(undefined);
		installClient({
			createRoom,
			getUserId: () => OWN_USER,
			getRoom: () => null,
			invite
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
		expect(invite).toHaveBeenCalledWith(CALL_ROOM, MEMBERSHIP_READER);
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

	it('lets every participant say who they are', async () => {
		/*
		 * Identity travels as an ENCRYPTED TIMELINE event, because room state
		 * is not encrypted and an identity in state is a record the
		 * homeserver can read — on this platform, which advice seeker chose
		 * which animal.
		 *
		 * In an encrypted room the power-level check sees the outer type,
		 * `m.room.encrypted`, whatever is sealed inside it. That was 50 while
		 * `users_default` is 0, so only the person who created the call could
		 * have sent one and everybody else would have appeared as initials —
		 * which is exactly what "identity is inherited, never derived"
		 * forbids.
		 *
		 * `state_default` stays shut: no participant writes room state here
		 * beyond their own call membership, granted above.
		 */
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
		expect(levels.events['m.room.encrypted']).toBe(0);
		expect(levels.users_default).toBe(0);
		expect(levels.state_default).toBeGreaterThanOrEqual(100);
		// And it is no longer room state at all.
		expect(levels.events[CALL_IDENTITY_EVENT_TYPE]).toBeUndefined();
	});

	it('does not name the creator in the power levels', async () => {
		/*
		 * From room version 12 — the DEFAULT on a current Synapse — the
		 * creator holds power implicitly and must not appear in
		 * `content.users`. Synapse rejects the whole `createRoom` call with
		 * "Creator user ... must not appear in content.users", so with the
		 * entry present the call room could not be created at all and every
		 * group call fell back into the counselling session room. The
		 * invite-only fallback did not save it: that retries with the same
		 * power levels.
		 *
		 * Leaving it out is safe on the older versions too, because
		 * `power_level_content_override` updates the default power level
		 * content key by key and the default already gives the creator 100.
		 * Measured on room versions 10, 11 and 12 by
		 * `scripts/verifyCallRoomMatrixRules.mjs`.
		 */
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
		expect(levels.users).toBeUndefined();
		// And the creator is not smuggled in under another key.
		expect(JSON.stringify(levels)).not.toContain(OWN_USER);
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
			getJoinedRoomMembers: vi.fn().mockResolvedValue({
				joined: {
					[OWN_USER]: {},
					'@asker:oriso.example': {}
				}
			})
		});

		await expect(createCallRoom()).resolves.toBe(CALL_ROOM);

		const fallback = createRoom.mock.calls[1][0] as CreateRoomOptions;
		expect(fallback.preset).toBe('private_chat');
		expect(stateContent(fallback, 'm.room.join_rules')).toBeUndefined();
		// The asker is invited; we do not invite ourselves.
		expect(invite).toHaveBeenCalledTimes(2);
		expect(invite).toHaveBeenCalledWith(CALL_ROOM, '@asker:oriso.example');
		expect(invite).toHaveBeenCalledWith(CALL_ROOM, MEMBERSHIP_READER);
	});

	it('fails closed when a participant cannot be invited', async () => {
		const createRoom = vi
			.fn()
			.mockRejectedValueOnce(new Error('nope'))
			.mockResolvedValueOnce({ room_id: CALL_ROOM });
		installClient({
			createRoom,
			invite: vi.fn().mockRejectedValue(new Error('M_FORBIDDEN')),
			getUserId: () => OWN_USER,
			getJoinedRoomMembers: vi.fn().mockResolvedValue({
				joined: {
					'@asker:oriso.example': {}
				}
			})
		});

		await expect(createCallRoom()).rejects.toThrow(
			/Could not invite 1 of 1/
		);
	});
});
