import {
	buildCallLifecycleContent,
	type CallLifecycleContent,
	type CallLifecycleMessage
} from '../utils/callLifecycleMessage';

interface TimelineClient {
	sendMessage(
		roomId: string,
		content: CallLifecycleContent,
		transactionId: string
	): Promise<{ event_id: string }>;
}

interface CallWrites {
	queue: Promise<void>;
	terminal: boolean;
	rootEventId?: string;
	lastContent?: string;
	transactions: Map<string, string>;
	callRoomId: string;
	callType: CallLifecycleMessage['callType'];
}

/**
 * No client may write this card right now — and that may pass.
 *
 * Distinct from any other failure because it is the one the caller should
 * wait out rather than give up on: a replacement client that has not finished
 * `initRustCrypto` is seconds away from being able to write, and a card that
 * is dropped meanwhile is dropped for good.
 */
export class TimelineClientUnavailableError extends Error {
	constructor() {
		super('Matrix client unavailable for call timeline');
		this.name = 'TimelineClientUnavailableError';
	}
}

/** Serializes encrypted room-message updates; Matrix sendMessage owns encryption. */
export class CallTimelineMessageService {
	private readonly calls = new Map<string, CallWrites>();

	constructor(private readonly client: () => TimelineClient | null) {}

	publish(message: CallLifecycleMessage): Promise<void> {
		const key = JSON.stringify([message.roomRef, message.callId]);
		let entry = this.calls.get(key);
		if (!entry) {
			entry = {
				queue: Promise.resolve(),
				terminal: false,
				transactions: new Map(),
				callRoomId: message.callRoomId,
				callType: message.callType
			};
			this.calls.set(key, entry);
		}
		if (
			entry.callRoomId !== message.callRoomId ||
			entry.callType !== message.callType
		) {
			return Promise.reject(
				new Error('Call identity cannot change during its lifecycle')
			);
		}
		if (entry.terminal && message.state === 'running')
			return Promise.resolve();
		if (message.state !== 'running') entry.terminal = true;
		const snapshot = {
			...message,
			participants: message.participants.map((participant) => ({
				...participant
			}))
		};
		const signature = JSON.stringify(buildCallLifecycleContent(snapshot));
		const state = entry;
		const write = async () => {
			if (state.lastContent === signature) return;
			const client = this.client();
			if (!client) throw new TimelineClientUnavailableError();
			let transactionId = state.transactions.get(signature);
			if (!transactionId) {
				transactionId = `call-timeline-${crypto.randomUUID()}`;
				state.transactions.set(signature, transactionId);
			}
			const response = await client.sendMessage(
				snapshot.roomRef,
				buildCallLifecycleContent(snapshot, state.rootEventId),
				transactionId
			);
			if (!response.event_id)
				throw new Error('Call timeline write returned no event ID');
			state.rootEventId ??= response.event_id;
			state.lastContent = signature;
			/*
			 * The transaction ID has done its job; keeping it makes the next
			 * identical revision disappear.
			 *
			 * It exists so that RETRYING a failed write cannot create a
			 * second call card — the same ID means the server either stores
			 * the event once or tells us it already did. But the map kept
			 * every signature forever, and a signature comes back: A and B
			 * present, B leaves, B rejoins. `lastContent` is the two-person
			 * state's predecessor by then, so the dedupe check lets the
			 * revision through — and it goes out under the ID that revision
			 * already used. Matrix treats a repeated transaction ID from the
			 * same access token as idempotent, returns the earlier event ID
			 * and stores nothing, so the card went on showing A alone while
			 * this client recorded the write as done.
			 *
			 * A failed write keeps its ID, which is the case the ID is for.
			 */
			state.transactions.delete(signature);
		};
		const next = state.queue.then(write, write);
		state.queue = next.catch(() => undefined);
		return next;
	}
}
