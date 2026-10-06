import { MatrixEvent } from 'matrix-js-sdk';
import type { PracticeRoomSeed } from '../fixtures/practiceScenario';
import { PRACTICE_COUNSELLOR_MATRIX_USER_ID } from '../fixtures/practiceCast';
import { buildTextMessageContent } from '../../utils/messageRelations';
import { markSandboxedMatrixClient } from '../../services/matrixClientRegistry';

type Listener = (...args: any[]) => void;

/** The emitter surface the app attaches to (`on`/`off`/`removeListener`). */
class PracticeEmitter {
	private readonly listeners = new Map<string, Set<Listener>>();

	on(name: string, listener: Listener): this {
		if (!this.listeners.has(name)) this.listeners.set(name, new Set());
		this.listeners.get(name)!.add(listener);
		return this;
	}

	addListener(name: string, listener: Listener): this {
		return this.on(name, listener);
	}

	once(name: string, listener: Listener): this {
		const wrapped: Listener = (...args) => {
			this.off(name, wrapped);
			listener(...args);
		};
		return this.on(name, wrapped);
	}

	off(name: string, listener: Listener): this {
		this.listeners.get(name)?.delete(listener);
		return this;
	}

	removeListener(name: string, listener: Listener): this {
		return this.off(name, listener);
	}

	removeAllListeners(name?: string): this {
		if (name) this.listeners.delete(name);
		else this.listeners.clear();
		return this;
	}

	listenerCount(name: string): number {
		return this.listeners.get(name)?.size ?? 0;
	}

	emit(name: string, ...args: unknown[]): boolean {
		const listeners = [...(this.listeners.get(name) ?? [])];
		listeners.forEach((listener) => listener(...args));
		return listeners.length > 0;
	}
}

export interface PracticeRoomMember {
	userId: string;
	name: string;
	rawDisplayName: string;
	membership: 'join';
	getAvatarUrl: () => null;
	getMxcAvatarUrl: () => undefined;
}

const member = (userId: string, displayName: string): PracticeRoomMember => ({
	userId,
	name: displayName,
	rawDisplayName: displayName,
	membership: 'join',
	getAvatarUrl: () => null,
	getMxcAvatarUrl: () => undefined
});

/** Duck-typed `Room`: the subset the chat view reads (see S0 notes). */
export class PracticeRoom extends PracticeEmitter {
	readonly timeline: MatrixEvent[] = [];
	private readonly members = new Map<string, PracticeRoomMember>();
	private readUpTo = -1;

	readonly currentState = {
		getStateEvents: () => [] as MatrixEvent[],
		maySendEvent: () => true,
		getMember: (userId: string) => this.getMember(userId),
		members: {} as Record<string, PracticeRoomMember>
	};

	constructor(
		readonly roomId: string,
		readonly name: string,
		private readonly ownUserId: string
	) {
		super();
	}

	addMember(userId: string, displayName: string): void {
		const entry = member(userId, displayName);
		this.members.set(userId, entry);
		this.currentState.members[userId] = entry;
	}

	getMember(userId: string): PracticeRoomMember | null {
		return this.members.get(userId) ?? null;
	}

	getMembers(): PracticeRoomMember[] {
		return [...this.members.values()];
	}

	getJoinedMembers(): PracticeRoomMember[] {
		return this.getMembers();
	}

	getJoinedMemberCount(): number {
		return this.members.size;
	}

	getMyMembership(): 'join' {
		return 'join';
	}

	getLiveTimeline() {
		return {
			getEvents: () => this.timeline,
			getState: () => this.currentState,
			getPaginationToken: (): null => null
		};
	}

	findEventById(eventId: string): MatrixEvent | undefined {
		return this.timeline.find((event) => event.getId() === eventId);
	}

	getUnreadNotificationCount(): number {
		return this.timeline
			.slice(this.readUpTo + 1)
			.filter((event) => event.getSender() !== this.ownUserId).length;
	}

	getThreadUnreadNotificationCount(): number {
		return 0;
	}

	getThreads(): [] {
		return [];
	}

	getThread(): null {
		return null;
	}

	hasEncryptionStateEvent(): boolean {
		return false;
	}

	getEventReadUpTo(): string | null {
		return this.timeline[this.readUpTo]?.getId() ?? null;
	}

	getReceiptsForEvent(): [] {
		return [];
	}

	markReadUpTo(event: MatrixEvent): void {
		const index = this.timeline.indexOf(event);
		if (index > this.readUpTo) this.readUpTo = index;
	}
}

export interface FakeMatrixServiceOptions {
	rooms: PracticeRoomSeed[];
	/** Hook for the script engine: called after every own message is appended. */
	onCounsellorMessage?: (roomId: string, text: string) => void;
	now?: () => number;
}

/** Duck-typed `MatrixClient`: never talks to a homeserver. */
export class FakeMatrixClient extends PracticeEmitter {
	readonly rooms = new Map<string, PracticeRoom>();
	readonly sentReadReceipts: string[] = [];
	private txn = 0;

	constructor(
		private readonly appendFromClient: (
			roomId: string,
			content: Record<string, any>
		) => MatrixEvent
	) {
		super();
		markSandboxedMatrixClient(this);
	}

	getUserId(): string {
		return PRACTICE_COUNSELLOR_MATRIX_USER_ID;
	}

	getSafeUserId(): string {
		return this.getUserId();
	}

	getDeviceId(): string {
		return 'PRACTICE';
	}

	getRoom(roomId: string): PracticeRoom | null {
		return this.rooms.get(roomId) ?? null;
	}

	getRooms(): PracticeRoom[] {
		return [...this.rooms.values()];
	}

	getSyncState(): 'PREPARED' {
		return 'PREPARED';
	}

	isInitialSyncComplete(): boolean {
		return true;
	}

	isRoomEncrypted(): boolean {
		return false;
	}

	getCrypto(): undefined {
		return undefined;
	}

	getAccountData(): undefined {
		return undefined;
	}

	makeTxnId(): string {
		return `practice-txn-${++this.txn}`;
	}

	/** Raw sends (supervisor notice in the session header) stay in memory. */
	async sendMessage(
		roomId: string,
		threadIdOrContent: unknown,
		contentOrTxnId?: unknown
	): Promise<{ event_id: string }> {
		const content = (
			typeof threadIdOrContent === 'object' && threadIdOrContent
				? threadIdOrContent
				: contentOrTxnId
		) as Record<string, any>;
		return { event_id: this.appendFromClient(roomId, content).getId()! };
	}

	async sendEvent(
		roomId: string,
		_type: string,
		content: Record<string, any>
	): Promise<{ event_id: string }> {
		return { event_id: this.appendFromClient(roomId, content).getId()! };
	}

	async sendReadReceipt(event: MatrixEvent): Promise<void> {
		const room = this.rooms.get(event.getRoomId() ?? '');
		room?.markReadUpTo(event);
		this.sentReadReceipts.push(event.getId()!);
		this.emit('Room.receipt', event, room);
	}

	async setRoomReadMarkers(): Promise<void> {}

	async sendTyping(): Promise<void> {}

	async joinRoom(roomId: string): Promise<PracticeRoom | null> {
		return this.getRoom(roomId);
	}

	cancelPendingEvent(): void {}

	startClient(): void {}

	stopClient(): void {}
}

const notInPractice = (what: string) =>
	Promise.reject(new Error(`${what} is not available in practice mode`));

/**
 * In-memory stand-in for `MatrixClientService`. Messages are appended to the
 * fake rooms and announced on the fake client; nothing is delegated to the
 * real client, the chat transport or the feedback-mail queue.
 */
export class FakeMatrixService {
	private readonly client: FakeMatrixClient;
	private readonly onCounsellorMessage?: (
		roomId: string,
		text: string
	) => void;
	private readonly now: () => number;
	private eventSeq = 0;

	constructor({ rooms, onCounsellorMessage, now }: FakeMatrixServiceOptions) {
		this.onCounsellorMessage = onCounsellorMessage;
		this.now = now ?? Date.now;
		this.client = new FakeMatrixClient((roomId, content) =>
			this.append(roomId, this.client.getUserId(), content)
		);
		rooms.forEach((seed) => {
			const room = new PracticeRoom(
				seed.roomId,
				seed.name,
				this.client.getUserId()
			);
			seed.members.forEach(({ userId, displayName }) =>
				room.addMember(userId, displayName)
			);
			this.client.rooms.set(seed.roomId, room);
			seed.messages.forEach(({ sender, body, ts }) =>
				room.timeline.push(
					this.event(seed.roomId, sender, textOf(body), ts)
				)
			);
		});
	}

	get sentReadReceipts(): ReadonlyArray<string> {
		return this.client.sentReadReceipts;
	}

	getClient(): FakeMatrixClient {
		return this.client;
	}

	isReady(): boolean {
		return true;
	}

	hasActiveClient(): boolean {
		return true;
	}

	getStaleDeviceRecoveryVersion(): number {
		return 0;
	}

	async getReadyClient(): Promise<FakeMatrixClient> {
		return this.client;
	}

	onSyncStateChange(callback: (state: string | null) => void): () => void {
		callback('PREPARED');
		return () => undefined;
	}

	/** The fake client is never replaced. */
	onClientChange(): () => void {
		return () => undefined;
	}

	holdTokenRefreshDuring<T>(operation: () => Promise<T>): Promise<T> {
		return operation();
	}

	async ensureFreshToken(): Promise<void> {}

	async refreshMatrixToken(): Promise<void> {}

	getRooms(): PracticeRoom[] {
		return this.client.getRooms();
	}

	getRoom(roomId: string): PracticeRoom | null {
		return this.client.getRoom(roomId);
	}

	getRoomMessages(roomId: string, limit = 50): MatrixEvent[] {
		return this.client.getRoom(roomId)?.timeline.slice(-limit) ?? [];
	}

	onRoomMessage(callback: (event: MatrixEvent, room: PracticeRoom) => void) {
		this.client.on('Room.timeline', (event: MatrixEvent, room) => {
			if (event.getType() === 'm.room.message') callback(event, room);
		});
	}

	async sendMessage(
		roomId: string,
		message: string,
		options?: Parameters<typeof buildTextMessageContent>[1]
	): Promise<{ event_id: string }> {
		const event = this.append(
			roomId,
			this.client.getUserId(),
			buildTextMessageContent(message, options) as Record<string, any>
		);
		return { event_id: event.getId()! };
	}

	async editMessage(
		roomId: string,
		targetEventId: string,
		message: string
	): Promise<{ event_id: string }> {
		const event = this.append(roomId, this.client.getUserId(), {
			'msgtype': 'm.text',
			'body': `* ${message}`,
			'm.new_content': { msgtype: 'm.text', body: message },
			'm.relates_to': { rel_type: 'm.replace', event_id: targetEventId }
		});
		return { event_id: event.getId()! };
	}

	sendReaction(): Promise<never> {
		return notInPractice('Reactions');
	}

	redactEvent(): Promise<never> {
		return notInPractice('Deleting messages');
	}

	sendFileMessage(..._args: unknown[]): Promise<never> {
		return notInPractice('Attachments');
	}

	createDirectMessageRoom(_userId: string): Promise<never> {
		return notInPractice('Creating rooms');
	}

	async sendTyping(): Promise<void> {}

	async logout(): Promise<void> {}

	stopAndCleanup(): void {}

	/** Scripted messages from the cast (asker, colleague, supervisor). */
	appendMessage(roomId: string, sender: string, body: string): MatrixEvent {
		return this.append(roomId, sender, textOf(body));
	}

	private append(
		roomId: string,
		sender: string,
		content: Record<string, any>
	): MatrixEvent {
		const room = this.client.getRoom(roomId);
		if (!room) {
			throw new Error(`Unknown practice room ${roomId}`);
		}
		const event = this.event(roomId, sender, content, this.now());
		room.timeline.push(event);
		const data = { liveEvent: true, timeline: room.getLiveTimeline() };
		this.client.emit('Room.timeline', event, room, false, false, data);
		room.emit('Room.timeline', event, room, false, false, data);
		if (sender === this.client.getUserId()) {
			this.onCounsellorMessage?.(roomId, String(content.body ?? ''));
		}
		return event;
	}

	private event(
		roomId: string,
		sender: string,
		content: Record<string, any>,
		ts: number
	): MatrixEvent {
		// No `$` prefix: the feedback-mail queue only stores `$` event ids, so
		// a practice send can never land in its persistent retry store.
		return new MatrixEvent({
			event_id: `practice-event-${++this.eventSeq}`,
			room_id: roomId,
			sender,
			type: 'm.room.message',
			origin_server_ts: ts,
			content
		});
	}
}

const textOf = (body: string) => ({ msgtype: 'm.text', body });

export const createFakeMatrixService = (options: FakeMatrixServiceOptions) =>
	new FakeMatrixService(options);
