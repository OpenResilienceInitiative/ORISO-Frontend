// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedbackMailIntentQueue } from './feedbackMailIntentQueue';

const USER = '@owner:example.org';
const OTHER = '@other:example.org';
const hint = {
	roomId: '!protected:example.org',
	matrixEventId: '$feedback',
	threadRootId: '$root'
};
let activeUser: string | null;
const queues: FeedbackMailIntentQueue[] = [];
const createQueue = (post = vi.fn().mockResolvedValue({})) => {
	const queue = new FeedbackMailIntentQueue({
		storage: () => localStorage,
		activeUser: () => activeUser,
		post
	});
	queues.push(queue);
	return { queue, post };
};
beforeEach(() => {
	localStorage.clear();
	activeUser = USER;
	vi.useFakeTimers();
});
afterEach(() => {
	queues.forEach((queue) => queue.stop());
	queues.length = 0;
	vi.useRealTimers();
});

describe('feedback mail metadata retry', () => {
	it('persists IDs only before POST and retries the same event without sending a Matrix message', async () => {
		const post = vi
			.fn()
			.mockRejectedValueOnce(new Error('offline'))
			.mockResolvedValue({});
		const { queue } = createQueue(post);
		queue.start(USER);
		await queue.enqueue(USER, {
			...hint,
			message: 'private',
			senderDisplayName: 'private name',
			token: 'private token'
		} as any);
		expect(post).toHaveBeenCalledTimes(1);
		expect(JSON.stringify({ ...localStorage })).not.toMatch(
			/private|token|senderDisplayName|message"/
		);
		expect(localStorage.length).toBe(1);
		await vi.advanceTimersByTimeAsync(1000);
		expect(post).toHaveBeenCalledTimes(2);
		expect(post.mock.calls[1][0]).toEqual({
			...hint,
			matrixRoom: true,
			feedbackMailIntent: true
		});
		expect(localStorage.length).toBe(0);
	});
	it('survives document reload and logout while only the original account may process it', async () => {
		const first = createQueue(
			vi.fn().mockRejectedValue(new Error('offline'))
		);
		first.queue.start(USER);
		await first.queue.enqueue(USER, hint);
		first.queue.stop();
		activeUser = OTHER;
		const second = createQueue();
		second.queue.start(OTHER);
		await second.queue.flush();
		expect(second.post).not.toHaveBeenCalled();
		expect(localStorage.length).toBe(1);
		activeUser = USER;
		second.queue.start(USER);
		await second.queue.flush();
		expect(second.post).toHaveBeenCalledOnce();
		expect(localStorage.length).toBe(0);
	});
	it('aborts an in-flight old-account attempt and keeps its hint after an account switch', async () => {
		let signal: AbortSignal | undefined;
		const { queue, post } = createQueue(
			vi.fn((_body, nextSignal) => {
				signal = nextSignal;
				return new Promise((_resolve, reject) =>
					nextSignal.addEventListener('abort', () =>
						reject(new Error('aborted'))
					)
				);
			})
		);
		queue.start(USER);
		const pending = queue.enqueue(USER, hint);
		await Promise.resolve();
		activeUser = OTHER;
		queue.start(OTHER);
		await pending;
		expect(signal?.aborted).toBe(true);
		expect(post).toHaveBeenCalledOnce();
		expect(localStorage.length).toBe(1);
	});
	it('does not overwrite different events submitted concurrently by two tabs', async () => {
		const first = createQueue(
			vi.fn().mockRejectedValue(new Error('offline'))
		);
		const second = createQueue(
			vi.fn().mockRejectedValue(new Error('offline'))
		);
		first.queue.start(USER);
		second.queue.start(USER);
		await Promise.all([
			first.queue.enqueue(USER, hint),
			second.queue.enqueue(USER, { ...hint, matrixEventId: '$second' })
		]);
		expect(localStorage.length).toBe(2);
	});
	it('deduplicates local event replay and drops expired or malformed entries', async () => {
		const post = vi.fn().mockRejectedValue(new Error('offline'));
		const { queue } = createQueue(post);
		queue.start(USER);
		await queue.enqueue(USER, hint);
		await queue.enqueue(USER, hint);
		expect(localStorage.length).toBe(1);
		queue.stop();
		vi.setSystemTime(Date.now() + 24 * 60 * 60 * 1000 + 1);
		const resumed = createQueue();
		resumed.queue.start(USER);
		await resumed.queue.flush();
		expect(resumed.post).not.toHaveBeenCalled();
		expect(localStorage.length).toBe(0);
	});
	it('never queues a missing event ID or posts a hint under a different account', async () => {
		const { queue, post } = createQueue();
		queue.start(USER);
		await queue.enqueue(USER, { ...hint, matrixEventId: '' });
		await queue.enqueue(OTHER, hint);
		expect(post).not.toHaveBeenCalled();
		expect(localStorage.length).toBe(1);
	});
});

it('retains a sent event whose originating Matrix account changed before its acknowledgement', async () => {
	activeUser = OTHER;
	const { queue, post } = createQueue();
	queue.start(OTHER);
	await queue.enqueue(USER, hint);
	expect(post).not.toHaveBeenCalled();
	expect(localStorage.length).toBe(1);
	activeUser = USER;
	queue.start(USER);
	await queue.flush();
	expect(post).toHaveBeenCalledOnce();
	expect(localStorage.length).toBe(0);
});

it('drops a definitively rejected hint but retains a temporarily missing Matrix event', async () => {
	const { queue } = createQueue(
		vi.fn().mockRejectedValue(new Error('FORBIDDEN'))
	);
	queue.start(USER);
	await queue.enqueue(USER, hint);
	expect(localStorage.length).toBe(0);
	const pending = createQueue(
		vi.fn().mockRejectedValue(new Error('NO_MATCH'))
	);
	pending.queue.start(USER);
	await pending.queue.enqueue(USER, hint);
	expect(localStorage.length).toBe(1);
});

it('processes a valid persisted event even when a malformed key precedes it after reload', async () => {
	localStorage.setItem('oriso.feedbackMailHint.malformed', '{');
	const key = `oriso.feedbackMailHint.${encodeURIComponent(USER)}.${encodeURIComponent(hint.matrixEventId)}`;
	localStorage.setItem(
		key,
		JSON.stringify({
			...hint,
			userId: USER,
			expiresAt: Date.now() + 86400000
		})
	);
	const { queue, post } = createQueue();
	queue.start(USER);
	await Promise.resolve();
	expect(post).toHaveBeenCalledOnce();
	expect(localStorage.length).toBe(0);
});
