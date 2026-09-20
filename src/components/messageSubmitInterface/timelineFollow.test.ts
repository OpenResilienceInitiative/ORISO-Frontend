// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import {
	AUTO_FOCUS_ATTRIBUTE,
	BOTTOM_TOLERANCE_PX,
	focusComposerAutomatically,
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

	/**
	 * Frank (16.09.): only a click or typing counts as writing. On desktop
	 * the app puts the cursor into the composer by itself when a chat
	 * opens; a reader who has not touched it is still just reading.
	 */
	it('is quiet while the focus is the one the app placed by itself', () => {
		const el = card('<div class="tiptap" tabindex="0"><p></p></div>');
		el.setAttribute(AUTO_FOCUS_ATTRIBUTE, '');
		expect(isComposerBusy(el, el.querySelector('.tiptap'))).toBe(false);
	});

	it('stays busy with a draft even when the focus was placed automatically', () => {
		const el = card('<div class="tiptap"><p>halber Satz</p></div>');
		el.setAttribute(AUTO_FOCUS_ATTRIBUTE, '');
		expect(isComposerBusy(el, el.querySelector('.tiptap'))).toBe(true);
	});
});

describe('focusComposerAutomatically', () => {
	const setUp = () => {
		document.body.innerHTML =
			'<div id="card"><div id="editor" tabindex="0"></div></div><button id="elsewhere">x</button>';
		return {
			card: document.getElementById('card')!,
			editor: document.getElementById('editor')!,
			elsewhere: document.getElementById('elsewhere')!
		};
	};

	it('marks the card when it moves the cursor there itself', () => {
		const { card, editor } = setUp();
		focusComposerAutomatically(card, () => editor.focus());
		expect(document.activeElement).toBe(editor);
		expect(card.hasAttribute(AUTO_FOCUS_ATTRIBUTE)).toBe(true);
	});

	it('does not mark a focus the person already placed', () => {
		const { card, editor } = setUp();
		editor.focus();
		focusComposerAutomatically(card, () => editor.focus());
		expect(card.hasAttribute(AUTO_FOCUS_ATTRIBUTE)).toBe(false);
	});

	it('leaves no mark when the focus did not land in the card', () => {
		const { card, elsewhere } = setUp();
		elsewhere.focus();
		focusComposerAutomatically(card, () => undefined);
		expect(card.hasAttribute(AUTO_FOCUS_ATTRIBUTE)).toBe(false);
	});

	it('does nothing without a card', () => {
		const focus = vi.fn();
		focusComposerAutomatically(null, focus);
		expect(focus).toHaveBeenCalledTimes(1);
	});
});
