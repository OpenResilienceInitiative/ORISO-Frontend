import { apiPostMessageEventNotification } from '../api/apiPostMessageEventNotification';
import { FETCH_ERRORS } from '../api/fetchData';
import { getMatrixClientService } from './matrixClientRegistry';

/** IDs only: encrypted message contents, names and credentials never enter this store. */
export const FEEDBACK_MAIL_HINT_PREFIX = 'oriso.feedbackMailHint.';
const TTL = 24 * 60 * 60 * 1000;
const MAX_RETRY_DELAY = 30000;
interface FeedbackMailHint {
	roomId: string;
	matrixEventId: string;
	threadRootId?: string | null;
}
interface StoredHint extends FeedbackMailHint {
	userId: string;
	expiresAt: number;
}
type Post = typeof apiPostMessageEventNotification;
interface Options {
	storage: () => Storage;
	activeUser: () => string | null;
	post: Post;
}
const validId = (value: unknown, prefix: string): value is string =>
	typeof value === 'string' &&
	value.startsWith(prefix) &&
	value.length > 1 &&
	value.length < 2048;
const keyFor = (userId: string, eventId: string) =>
	`${FEEDBACK_MAIL_HINT_PREFIX}${encodeURIComponent(userId)}.${encodeURIComponent(eventId)}`;

/**
 * Retries only the metadata for an already-sent feedback event. Matrix sends
 * never enter this queue. Every attempt rechecks the current Matrix account;
 * logout/client changes abort requests but retain IDs for the same user's login.
 */
export class FeedbackMailIntentQueue {
	private userId: string | null = null;
	private generation = 0;
	private timer: ReturnType<typeof setTimeout> | null = null;
	private delay = 1000;
	private readonly inFlight = new Map<string, AbortController>();
	private readonly memory = new Map<string, StoredHint>();
	private readonly wake = () => void this.flush();

	constructor(private readonly options: Options) {}

	public start(userId: string | null): void {
		this.stop();
		this.userId = validId(userId, '@') ? userId : null;
		this.delay = 1000;
		if (!this.userId) return;
		window.addEventListener('online', this.wake);
		window.addEventListener('storage', this.wake);
		void this.flush();
	}

	public stop(): void {
		this.generation++;
		this.userId = null;
		if (this.timer) clearTimeout(this.timer);
		this.timer = null;
		this.inFlight.forEach((controller) => controller.abort());
		this.inFlight.clear();
		window.removeEventListener('online', this.wake);
		window.removeEventListener('storage', this.wake);
	}

	public async enqueue(
		userId: string | null,
		hint: FeedbackMailHint
	): Promise<void> {
		if (
			!validId(userId, '@') ||
			!validId(hint.roomId, '!') ||
			!validId(hint.matrixEventId, '$')
		)
			return;
		const key = keyFor(userId, hint.matrixEventId);
		const record: StoredHint = {
			userId,
			roomId: hint.roomId,
			matrixEventId: hint.matrixEventId,
			threadRootId: validId(hint.threadRootId, '$')
				? hint.threadRootId
				: null,
			expiresAt: Date.now() + TTL
		};
		// One key per event: another tab cannot overwrite a different pending event.
		this.memory.set(key, record);
		try {
			this.options.storage().setItem(key, JSON.stringify(record));
		} catch {
			// Disabled storage still permits immediate delivery and retries in this
			// tab. It cannot provide reload durability; no message is re-sent.
		}
		if (!this.userId && this.options.activeUser() === userId)
			this.start(userId);
		await this.flush();
	}

	private records(): Map<string, StoredHint> {
		const result = new Map(this.memory);
		try {
			const storage = this.options.storage();
			for (let i = 0; i < storage.length; i++) {
				const key = storage.key(i);
				if (!key?.startsWith(FEEDBACK_MAIL_HINT_PREFIX)) continue;
				try {
					result.set(key, JSON.parse(storage.getItem(key) || 'null'));
				} catch {
					this.remove(key);
				}
			}
		} catch {
			/* Immediate delivery remains available if storage is disabled. */
		}
		return result;
	}

	private remove(key: string): void {
		this.memory.delete(key);
		try {
			this.options.storage().removeItem(key);
		} catch {
			/* Disabled storage. */
		}
	}

	public async flush(): Promise<void> {
		const userId = this.userId;
		const generation = this.generation;
		if (!userId || this.options.activeUser() !== userId) return;
		let pending = false;
		for (const [key, record] of this.records()) {
			if (
				!record ||
				!validId(record.userId, '@') ||
				!validId(record.roomId, '!') ||
				!validId(record.matrixEventId, '$') ||
				key !== keyFor(record.userId, record.matrixEventId) ||
				!Number.isFinite(record.expiresAt) ||
				record.expiresAt <= Date.now()
			) {
				this.remove(key);
				continue;
			}
			if (record.userId !== userId || this.inFlight.has(key)) continue;
			if (
				generation !== this.generation ||
				this.options.activeUser() !== userId
			)
				return;
			const controller = new AbortController();
			this.inFlight.set(key, controller);
			try {
				await this.options.post(
					{
						roomId: record.roomId,
						matrixEventId: record.matrixEventId,
						threadRootId: validId(record.threadRootId, '$')
							? record.threadRootId
							: null,
						matrixRoom: true,
						feedbackMailIntent: true
					},
					controller.signal
				);
				if (generation === this.generation) this.remove(key);
			} catch (error) {
				if (generation !== this.generation) return;
				if (
					error instanceof Error &&
					[FETCH_ERRORS.BAD_REQUEST, FETCH_ERRORS.FORBIDDEN].includes(
						error.message
					)
				)
					this.remove(key);
				else pending = true;
			} finally {
				if (this.inFlight.get(key) === controller)
					this.inFlight.delete(key);
			}
		}
		if (pending && generation === this.generation && !this.timer) {
			this.timer = setTimeout(() => {
				this.timer = null;
				void this.flush();
			}, this.delay);
			this.delay = Math.min(this.delay * 2, MAX_RETRY_DELAY);
		}
	}
}

export const feedbackMailIntentQueue = new FeedbackMailIntentQueue({
	storage: () => window.localStorage,
	activeUser: () =>
		getMatrixClientService()?.getClient()?.getUserId() || null,
	post: apiPostMessageEventNotification
});
