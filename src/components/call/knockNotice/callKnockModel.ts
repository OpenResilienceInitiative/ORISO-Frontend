/**
 * Somebody knocking on a call in their own 1:1 conversation, after arriving
 * through a counsellor's audio or video direct link (ADR-029 §2).
 * Mirrors UserService `CallKnockDTO` (ORISO-UserService#1479).
 */
export type CallKnockStatus = 'PENDING' | 'ADMITTED' | 'DECLINED' | 'CANCELLED';

export type CallKnockMedium = 'CHAT' | 'AUDIO' | 'VIDEO';

export interface CallKnock {
	id: number;
	sessionId: number;
	/** The name the person chose (decoded username, never e-mail or real name). Since US#1479 @ 13cb3700. */
	displayName?: string | null;
	status: CallKnockStatus;
	medium: CallKnockMedium;
	requestedAt: string;
	decidedAt?: string | null;
}

/**
 * Which call the knocks belong to. The server limits the list and
 * "admit all" to it (US#1479 @ 13cb3700); "admit all" refuses without one.
 */
export type CallKnockScope =
	| { sessionId: number; matrixRoomId?: never }
	| { matrixRoomId: string; sessionId?: never };

export const scopeQuery = (scope: CallKnockScope): string =>
	scope.sessionId !== undefined
		? `sessionId=${encodeURIComponent(String(scope.sessionId))}`
		: `matrixRoomId=${encodeURIComponent(scope.matrixRoomId)}`;

/**
 * The call's CONVERSATION room (US#1488 / #1479): the 1:1 conversation, or
 * the group's room in a group call — the room the call signals in
 * (`signalRoomId`). Never the call's own media room (`elementCallRoomId`):
 * the server does not know it as a conversation. `roomId` counts only when
 * it is not that media room (the older 1:1 calls run in the chat room).
 * `null` when there is no such room: then nothing is asked.
 */
export const callKnockScopeOf = (
	call:
		| { roomId?: string; signalRoomId?: string; elementCallRoomId?: string }
		| null
		| undefined
): CallKnockScope | null => {
	const fallback =
		call?.roomId && call.roomId !== call.elementCallRoomId
			? call.roomId
			: undefined;
	const matrixRoomId = call?.signalRoomId || fallback;
	return matrixRoomId ? { matrixRoomId } : null;
};

/** The server's name, or `null` when it is empty: the notice then says "Eine Person". */
export const knockerName = (knock: CallKnock): string | null =>
	knock.displayName?.trim() || null;

/** What the notice shows: the knock, and who it is. */
export interface KnockingPerson {
	id: number;
	/** `null` when the server sent no name. */
	name: string | null;
	medium: CallKnockMedium;
}

/** The knocks a fresh list adds to the ones already known: those ring. */
export const newKnockIds = (
	known: ReadonlySet<number>,
	knocks: readonly CallKnock[]
): number[] => knocks.map((k) => k.id).filter((id) => !known.has(id));

/** Keeps the page on screen when the list shrinks under it. */
export const clampPage = (page: number, count: number): number =>
	count <= 0 ? 0 : Math.min(Math.max(page, 0), count - 1);
