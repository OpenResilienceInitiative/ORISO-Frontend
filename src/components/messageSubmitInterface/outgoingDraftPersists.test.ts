import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	resetOutgoingDraftPersists,
	trackOutgoingDraftPersist,
	waitForOutgoingDraftPersists
} from './outgoingDraftPersists';

describe('outgoingDraftPersists', () => {
	afterEach(() => {
		resetOutgoingDraftPersists();
		vi.useRealTimers();
	});

	it('makes the next load wait for a save started on leave', async () => {
		let release: () => void = () => {};
		const save = new Promise<void>((resolve) => {
			release = resolve;
		});
		trackOutgoingDraftPersist('scope:a', save);

		const order: string[] = [];
		const loaded = waitForOutgoingDraftPersists(['scope:a']).then(() =>
			order.push('load')
		);
		await Promise.resolve();
		expect(order).toEqual([]);

		release();
		await loaded;
		expect(order).toEqual(['load']);
	});

	it('does not wait for other scopes or settled saves', async () => {
		trackOutgoingDraftPersist('scope:b', new Promise(() => {}));
		await waitForOutgoingDraftPersists(['scope:c']);

		const failed = Promise.reject(new Error('offline'));
		trackOutgoingDraftPersist('scope:d', failed);
		await expect(
			waitForOutgoingDraftPersists(['scope:d'])
		).resolves.toBeUndefined();
	});

	it('gives up waiting on a hung save after the cap', async () => {
		vi.useFakeTimers();
		trackOutgoingDraftPersist('scope:e', new Promise(() => {}));
		const waited = waitForOutgoingDraftPersists(['scope:e']);
		await vi.advanceTimersByTimeAsync(3000);
		await expect(waited).resolves.toBeUndefined();
	});
});
