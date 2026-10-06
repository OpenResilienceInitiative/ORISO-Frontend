/**
 * Practice ids never collide with real ids: real session/agency ids are
 * positive database keys, real Matrix ids live on a routable homeserver.
 * Private to the fixtures; S1's `practiceIds` is the shared module the
 * integrator reconciles this with.
 */
export const PRACTICE_HOMESERVER = 'practice.invalid';

const PRACTICE_ROOM_PREFIX = '!practice-';

export const practiceRoomId = (n: number): string =>
	`${PRACTICE_ROOM_PREFIX}${n}:${PRACTICE_HOMESERVER}`;

export const practiceUserId = (localpart: string): string =>
	`@practice-${localpart}:${PRACTICE_HOMESERVER}`;

export const isPracticeRoomId = (roomId: unknown): roomId is string =>
	typeof roomId === 'string' &&
	roomId.startsWith(PRACTICE_ROOM_PREFIX) &&
	roomId.endsWith(`:${PRACTICE_HOMESERVER}`);

export const isPracticeId = (id: unknown): boolean => {
	const value = typeof id === 'string' ? Number(id) : id;
	return typeof value === 'number' && Number.isInteger(value) && value < 0;
};

export const PRACTICE_AGENCY_ID = -1;
/** The one practice case; both start states (enquiry, accepted case) use it. */
export const PRACTICE_ENQUIRY_SESSION_ID = -1;
export const PRACTICE_MAIN_ROOM_ID = practiceRoomId(1);
export const PRACTICE_TEAM_ROOM_ID = practiceRoomId(2);
export const PRACTICE_SUPERVISION_ROOM_ID = practiceRoomId(3);
