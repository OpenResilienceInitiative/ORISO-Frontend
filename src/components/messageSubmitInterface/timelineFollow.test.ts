// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
	BOTTOM_TOLERANCE_PX,
	isComposerBusy,
	isTimelineAtBottom,
	shouldClearAtBottomAfterSuppressedFollow,
	shouldFollowNewMessage,
	unreadCountAfterArrival
} from './timelineFollow';

describe('isTimelineAtBottom', () => {
	const metrics = { scrollTop: 860, scrollHeight: 1367, clientHeight: 507 };

	it('counts the exact bottom', () => {
		expect(isTimelineAtBottom(metrics)).toBe(true);
	});

	it('survives the fractional gap a composer resize leaves behind', () => {
		// 1280×640 dual view, measured: the old ±1 px check called this
		// "scrolled up" and stopped following.
		expect(isTimelineAtBottom({ ...metrics, scrollTop: 860 - 12 })).toBe(
			true
		);
	});

	it('knows a reader who scrolled away', () => {
		expect(
			isTimelineAtBottom({
				...metrics,
				scrollTop: 860 - BOTTOM_TOLERANCE_PX - 1
			})
		).toBe(false);
	});
});

describe('shouldFollowNewMessage', () => {
	it("always follows the reader's own message", () => {
		expect(
			shouldFollowNewMessage({
				isOwnMessage: true,
				atBottom: false,
				isComposing: true
			})
		).toBe(true);
	});

	it('follows when the reader is just watching', () => {
		expect(
			shouldFollowNewMessage({
				isOwnMessage: false,
				atBottom: true,
				isComposing: false
			})
		).toBe(true);
	});

	it('holds the place while the reader writes — the arrow takes over', () => {
		expect(
			shouldFollowNewMessage({
				isOwnMessage: false,
				atBottom: true,
				isComposing: true
			})
		).toBe(false);
	});

	it('holds the place when the reader scrolled up', () => {
		expect(
			shouldFollowNewMessage({
				isOwnMessage: false,
				atBottom: false,
				isComposing: false
			})
		).toBe(false);
	});
});

describe('shouldClearAtBottomAfterSuppressedFollow', () => {
	it('keeps the bottom flag during the first paint so the empty timeline can still follow', () => {
		expect(
			shouldClearAtBottomAfterSuppressedFollow({
				initialScrollCompleted: false,
				followed: false,
				atBottom: true
			})
		).toBe(false);
	});

	it('clears the stale bottom flag once follow is declined after setup', () => {
		expect(
			shouldClearAtBottomAfterSuppressedFollow({
				initialScrollCompleted: true,
				followed: false,
				atBottom: true
			})
		).toBe(true);
	});

	it('leaves the flag alone when the view did follow', () => {
		expect(
			shouldClearAtBottomAfterSuppressedFollow({
				initialScrollCompleted: true,
				followed: true,
				atBottom: true
			})
		).toBe(false);
	});
});

describe('unreadCountAfterArrival', () => {
	it('does not count the first remote message on an empty timeline as unread', () => {
		expect(unreadCountAfterArrival(1, 0, false)).toBe(0);
	});

	it('counts later arrivals once the initial scroll has finished', () => {
		expect(unreadCountAfterArrival(5, 4, true)).toBe(1);
	});
});

describe('isComposerBusy', () => {
	const card = (html: string) => {
		const el = document.createElement('div');
		el.className = 'textarea__wrapper-send-message';
		el.innerHTML = html;
		return el;
	};

	it('is quiet with an empty, unfocused composer', () => {
		expect(
			isComposerBusy(card('<div class="tiptap"><p></p></div>'), null)
		).toBe(false);
	});

	it('is busy while a draft stands in the editor', () => {
		expect(
			isComposerBusy(
				card('<div class="tiptap"><p>halber Satz</p></div>'),
				null
			)
		).toBe(true);
	});

	it('is busy while the composer holds focus', () => {
		const el = card('<button type="button">send</button>');
		expect(isComposerBusy(el, el.querySelector('button'))).toBe(true);
	});

	it('is quiet when there is no composer at all (read-only session)', () => {
		expect(isComposerBusy(null, null)).toBe(false);
	});
});
