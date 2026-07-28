// @vitest-environment jsdom
/**
 * Thread-panel-UX (#435) — per-thread unread state.
 *
 * Device-local approximation (localStorage last-read timestamp per thread),
 * NOT full cross-device Matrix thread read receipts (MSC3771/3773) — that
 * needs a live homeserver to verify against, which isn't available. Same
 * "mirror" pattern already used by notificationSettings/store.ts.
 */

import { beforeEach, describe, it, expect } from 'vitest';
import {
	getThreadLastReadTs,
	markThreadRead,
	isThreadUnread
} from './threadUnread';

describe('isThreadUnread', () => {
	it('is unread when the last reply is newer than the last read timestamp', () => {
		expect(isThreadUnread(2000, 1000)).toBe(true);
	});

	it('is read when the last reply is at or before the last read timestamp', () => {
		expect(isThreadUnread(1000, 1000)).toBe(false);
		expect(isThreadUnread(1000, 2000)).toBe(false);
	});
});

describe('getThreadLastReadTs / markThreadRead (localStorage mirror)', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it('defaults to 0 (never read) for an unknown thread', () => {
		expect(getThreadLastReadTs('!room:hs', '$root:hs')).toBe(0);
	});

	it('persists and reads back the last-read timestamp, scoped per room+thread', () => {
		markThreadRead('!room:hs', '$root:hs', 5000);
		expect(getThreadLastReadTs('!room:hs', '$root:hs')).toBe(5000);
		expect(getThreadLastReadTs('!room:hs', '$other:hs')).toBe(0);
		expect(getThreadLastReadTs('!other-room:hs', '$root:hs')).toBe(0);
	});

	it('only advances forward (a stale/out-of-order mark never regresses)', () => {
		markThreadRead('!room:hs', '$root:hs', 5000);
		markThreadRead('!room:hs', '$root:hs', 3000);
		expect(getThreadLastReadTs('!room:hs', '$root:hs')).toBe(5000);
	});
});
