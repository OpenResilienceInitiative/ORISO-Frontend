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
			if (!client)
				throw new Error('Matrix client unavailable for call timeline');
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
		};
		const next = state.queue.then(write, write);
		state.queue = next.catch(() => undefined);
		return next;
	}
}
