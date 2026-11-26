import type { MatrixClient, Room } from 'matrix-js-sdk';

// String literals (not the SDK enums) so the guard has no runtime SDK import.
const JOIN_MEMBERSHIP = 'join';
const REACTION_EVENT_TYPE = 'm.reaction';

/**
 * P0 plaintext leak guard.
 *
 * matrix-js-sdk only encrypts an outgoing event when the room is in the
 * client's store: `encryptEventIfNeeded()` returns early with "If the room is
 * unknown, we cannot encrypt for it" and the event is PUT in the clear. A
 * room is missing from the store whenever a send runs on a client generation
 * that has not finished its first sync — a token refresh or a stale-device
 * recovery builds a brand-new client right before the send, and a page that
 * sends before its initial sync has the same gap. `joinRoom()` does not put
 * the room into the store either. On Dev this leaked the consultant's first
 * Live Chat message as `m.room.message` into rooms that had `m.room.encryption`
 * from creation.
 *
 * The guard makes every send wait (bounded) until the client holds the room as
 * a joined, synced room — only then does the SDK know the room's encryption
 * state — and refuses the send otherwise. Refusing is always safe: the
 * composer keeps the text and offers the retry.
 */

export const SEND_ROOM_WAIT_MS = 20_000;
const SEND_ROOM_POLL_INTERVAL_MS = 250;

export interface SendRoomWaitOptions {
	waitMs?: number;
	pollIntervalMs?: number;
}

export class MatrixRoomNotSyncedError extends Error {
	public readonly roomId: string;

	constructor(roomId: string) {
		super(
			'Refusing to send: the Matrix client has not synced this room yet, so the message could not be encrypted'
		);
		this.name = 'MatrixRoomNotSyncedError';
		this.roomId = roomId;
	}
}

const isJoinedRoom = (room: Room | null | undefined): room is Room =>
	Boolean(room) && room!.getMyMembership() === JOIN_MEMBERSHIP;

const sleep = (ms: number) =>
	new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Resolves once the client holds `roomId` as a joined room from sync. */
export const waitForJoinedRoom = async (
	client: MatrixClient,
	roomId: string,
	{
		waitMs = SEND_ROOM_WAIT_MS,
		pollIntervalMs = SEND_ROOM_POLL_INTERVAL_MS
	}: SendRoomWaitOptions = {}
): Promise<Room> => {
	const deadline = Date.now() + waitMs;
	while (true) {
		const room = client.getRoom(roomId);
		if (isJoinedRoom(room)) {
			return room;
		}
		const remaining = deadline - Date.now();
		if (remaining <= 0) {
			throw new MatrixRoomNotSyncedError(roomId);
		}
		await sleep(Math.min(pollIntervalMs, remaining));
	}
};

/**
 * `sendEvent(roomId, eventType, content, txnId?)` or
 * `sendEvent(roomId, threadId | null, eventType, content, txnId?)` — the SDK
 * treats the second argument as a thread id when it is null or an event id.
 */
const resolveEventType = (args: unknown[]): unknown => {
	const [threadIdOrEventType, eventType] = args;
	const isThreadId =
		threadIdOrEventType === null ||
		(typeof threadIdOrEventType === 'string' &&
			threadIdOrEventType.startsWith('$'));
	return isThreadId ? eventType : threadIdOrEventType;
};

/**
 * Wraps `client.sendEvent` — the funnel of sendMessage, sendTextMessage,
 * sendHtmlMessage, sendNotice, sticker and custom event sends — so that no
 * room event leaves before the room is synced. Reactions pass through: the
 * SDK never encrypts `m.reaction`, regardless of room state.
 */
export const installSendRoomGuard = (
	client: MatrixClient,
	options?: SendRoomWaitOptions
): void => {
	// Every matrix-js-sdk client has sendEvent. Test doubles and the practice
	// fake that lack it have no SDK encryption path to guard.
	if (typeof client.sendEvent !== 'function') {
		return;
	}
	const sendEvent = client.sendEvent.bind(client) as (
		...args: unknown[]
	) => ReturnType<MatrixClient['sendEvent']>;

	const guardedSendEvent = async (roomId: string, ...rest: unknown[]) => {
		if (resolveEventType(rest) !== REACTION_EVENT_TYPE) {
			await waitForJoinedRoom(client, roomId, options);
		}
		return sendEvent(roomId, ...rest);
	};

	(client as unknown as { sendEvent: typeof guardedSendEvent }).sendEvent =
		guardedSendEvent;
};
