/**
 * Access rules for the dedicated Element Call room.
 *
 * The call room is created per call and is separate from the counselling
 * session room, so its join rule is the only thing standing between a call and
 * anyone who has seen its room id.
 */
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';

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
	invite?: string[];
	initial_state?: { type: string; content: Record<string, unknown> }[];
};

const stateContent = (
	options: CreateRoomOptions,
	type: string
): Record<string, unknown> | undefined =>
	options.initial_state?.find((event) => event.type === type)?.content;

const installClient = (client: Record<string, unknown>): void => {
	setMatrixClientServiceRef({
		getClient: () => ({
			getCapabilities: vi
				.fn()
				.mockResolvedValue({ 'm.room_versions': { default: '12' } }),
			getStateEvent: vi.fn().mockResolvedValue({ membership: 'invite' }),
			...client
		})
	} as never);
};

const createCallRoom = async (
	sourceRoomId = SESSION_ROOM,
	roomName?: string
): Promise<string> =>
	/*
	 * The method hands back the client it created the room with, so that the
	 * cleanup path can leave and forget through THAT account rather than
	 * through whatever the registry holds by then. These tests are about the
	 * room, so they take the id and drop the rest.
	 */
	(
		await (
			callManager as unknown as {
				createElementCallRoom: (
					roomId: string,
					callId: string,
					roomName?: string
				) => Promise<{ roomId: string }>;
			}
		).createElementCallRoom(sourceRoomId, 'test-call', roomName)
	).roomId;

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

	it.each(['9', '10', '12'])(
		'restricts the call to members of the counselling session on room version %s',
		async (version) => {
			const createRoom = vi
				.fn()
				.mockResolvedValue({ room_id: CALL_ROOM });
			const invite = vi.fn().mockResolvedValue(undefined);
			const getStateEvent = vi
				.fn()
				.mockResolvedValue({ membership: 'invite' });
			installClient({
				createRoom,
				getCapabilities: vi.fn().mockResolvedValue({
					'm.room_versions': { default: version }
				}),
				getUserId: () => OWN_USER,
				getRoom: () => null,
				getStateEvent,
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
			expect(options.invite).toEqual([MEMBERSHIP_READER]);
			expect(invite).not.toHaveBeenCalled();
			expect(getStateEvent).toHaveBeenCalledWith(
				CALL_ROOM,
				'm.room.member',
				MEMBERSHIP_READER
			);
		}
	);

	describe('room name (#2170)', () => {
		const roomNameOf = async (roomName?: string): Promise<unknown> => {
			const createRoom = vi
				.fn()
				.mockResolvedValue({ room_id: CALL_ROOM });
			installClient({
				createRoom,
				getUserId: () => OWN_USER,
				getRoom: () => null,
				invite: vi.fn()
			});
			await createCallRoom(SESSION_ROOM, roomName);
			return (createRoom.mock.calls[0][0] as { name?: string }).name;
		};

		it('names the room after the direct link it was started from', async () => {
			await expect(roomNameOf('Flyer Schule')).resolves.toBe(
				'Flyer Schule'
			);
		});

		it('calls the room "Anruf" when nothing names it', async () => {
			await expect(roomNameOf()).resolves.toBe('Anruf');
		});

		it('never puts the session room id into the room name', async () => {
			for (const name of [undefined, '', '   ', SESSION_ROOM]) {
				const roomName = await roomNameOf(name);
				expect(String(roomName)).not.toContain(SESSION_ROOM);
				expect(String(roomName)).not.toMatch(/Group call/i);
			}
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

	it.each([
		[
			'legacy version',
			async () => ({ 'm.room_versions': { default: '8' } })
		],
		['missing version', async () => ({})],
		[
			'unknown version',
			async () => ({ 'm.room_versions': { default: 'custom' } })
		],
		[
			'capability error',
			async () => {
				throw new Error('capabilities unavailable');
			}
		]
	])(
		'chooses one private invite-only creation after %s',
		async (_, getCapabilities) => {
			const createRoom = vi
				.fn()
				.mockResolvedValue({ room_id: CALL_ROOM });
			const invite = vi.fn().mockResolvedValue(undefined);
			installClient({
				createRoom,
				getCapabilities,
				invite,
				getUserId: () => OWN_USER,
				getJoinedRoomMembers: vi.fn().mockResolvedValue({
					joined: {
						[OWN_USER]: {},
						[MEMBERSHIP_READER]: {},
						'@asker:oriso.example': {}
					}
				})
			});

			await expect(createCallRoom()).resolves.toBe(CALL_ROOM);

			expect(createRoom).toHaveBeenCalledTimes(1);
			const fallback = createRoom.mock.calls[0][0] as CreateRoomOptions;
			expect(fallback.preset).toBe('private_chat');
			expect(stateContent(fallback, 'm.room.join_rules')).toBeUndefined();
			expect(fallback.invite).toEqual([MEMBERSHIP_READER]);
			expect(invite).toHaveBeenCalledExactlyOnceWith(
				CALL_ROOM,
				'@asker:oriso.example'
			);
		}
	);

	it.each([
		Object.assign(new Error('reader invite rejected'), {
			errcode: 'M_FORBIDDEN'
		}),
		new Error('connection lost during creation')
	])('does not create another room after %s', async (error) => {
		const createRoom = vi.fn().mockRejectedValue(error);
		const getStateEvent = vi.fn();
		installClient({ createRoom, getStateEvent });

		await expect(createCallRoom()).rejects.toBe(error);
		expect(createRoom).toHaveBeenCalledTimes(1);
		expect(getStateEvent).not.toHaveBeenCalled();
	});

	it('accepts an initial reader invitation that was already joined', async () => {
		installClient({
			createRoom: vi.fn().mockResolvedValue({ room_id: CALL_ROOM }),
			getStateEvent: vi.fn().mockResolvedValue({ membership: 'join' })
		});

		await expect(createCallRoom()).resolves.toBe(CALL_ROOM);
	});

	it('leaves and forgets a created room without the reader', async () => {
		const leave = vi.fn().mockResolvedValue(undefined);
		const forget = vi.fn().mockResolvedValue(undefined);
		installClient({
			createRoom: vi.fn().mockResolvedValue({ room_id: CALL_ROOM }),
			getStateEvent: vi.fn().mockResolvedValue({ membership: 'leave' }),
			leave,
			forget
		});

		await expect(createCallRoom()).rejects.toThrow(
			'reader was not invited'
		);
		expect(leave).toHaveBeenCalledExactlyOnceWith(CALL_ROOM);
		expect(forget).toHaveBeenCalledExactlyOnceWith(CALL_ROOM);
	});

	it('fails closed when a participant cannot be invited', async () => {
		const createRoom = vi.fn().mockResolvedValue({ room_id: CALL_ROOM });
		installClient({
			createRoom,
			getCapabilities: vi.fn().mockResolvedValue({
				'm.room_versions': { default: '8' }
			}),
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
