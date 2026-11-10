/**
 * Finding a marked passage again inside a rendered message bubble.
 *
 * The selection's `toString()` and the bubble's text nodes disagree on
 * whitespace (line breaks, `<br>`, collapsed spaces), so both sides are
 * compared with runs of whitespace collapsed to one space. The in-bubble
 * quote of an earlier reply is skipped: a passage always belongs to the
 * message's own text.
 */

const SKIP_SELECTOR =
	'.messageItem__replyQuote, button, [aria-hidden="true"], .messageItem__metaData, .messageItem__timeRail, .messageItem__reactions';

export const normalizePassage = (text: string): string =>
	text.replace(/\s+/g, ' ').trim();

type Mapped = { node: Text; offset: number };

const collectText = (root: Element): { text: string; map: Mapped[] } => {
	const map: Mapped[] = [];
	let text = '';
	let lastWasSpace = true;
	const walker = root.ownerDocument.createTreeWalker(
		root,
		NodeFilter.SHOW_TEXT,
		{
			acceptNode: (node) =>
				node.parentElement?.closest(SKIP_SELECTOR)
					? NodeFilter.FILTER_REJECT
					: NodeFilter.FILTER_ACCEPT
		}
	);
	let current = walker.nextNode() as Text | null;
	while (current) {
		const value = current.data;
		for (let offset = 0; offset < value.length; offset++) {
			const isSpace = /\s/.test(value[offset]);
			if (isSpace && lastWasSpace) {
				continue;
			}
			text += isSpace ? ' ' : value[offset];
			map.push({ node: current, offset });
			lastWasSpace = isSpace;
		}
		current = walker.nextNode() as Text | null;
	}
	return { text, map };
};

/** The DOM range of `passage` inside `root`, or null when it is not there. */
export const findPassageRange = (
	root: Element,
	passage: string
): Range | null => {
	const wanted = normalizePassage(passage);
	if (!wanted) {
		return null;
	}
	const { text, map } = collectText(root);
	const start = text.indexOf(wanted);
	if (start < 0) {
		return null;
	}
	const first = map[start];
	const last = map[start + wanted.length - 1];
	const range = root.ownerDocument.createRange();
	range.setStart(first.node, first.offset);
	range.setEnd(last.node, last.offset + 1);
	return range;
};

/** The bubble that holds the text of message `eventId` inside `scope`. */
export const findMessageBubble = (
	scope: ParentNode,
	eventId: string
): HTMLElement | null => {
	const escaped =
		typeof CSS !== 'undefined' && CSS.escape
			? CSS.escape(eventId)
			: eventId.replace(/"/g, '\\"');
	return scope.querySelector<HTMLElement>(
		`[data-message-id="${escaped}"] .messageItem__message`
	);
};

type HighlightRegistry = {
	set: (name: string, highlight: unknown) => void;
	delete: (name: string) => void;
};

const highlightRegistry = (): HighlightRegistry | null => {
	const registry = (CSS as unknown as { highlights?: HighlightRegistry })
		?.highlights;
	const HighlightCtor = (window as unknown as { Highlight?: unknown })
		.Highlight;
	return registry && HighlightCtor ? registry : null;
};

/**
 * Paints `range` with the named CSS custom highlight (`::highlight(name)`),
 * without touching the DOM React owns. Returns a cleanup. Browsers without
 * the Highlight API simply skip the paint; the caller's bubble cue remains.
 */
export const paintPassage = (name: string, range: Range | null) => {
	const registry = highlightRegistry();
	if (!registry || !range) {
		return () => {};
	}
	const HighlightCtor = (
		window as unknown as { Highlight: new (...ranges: Range[]) => unknown }
	).Highlight;
	registry.set(name, new HighlightCtor(range));
	return () => registry.delete(name);
};

/**
 * A message re-render replaces its text nodes and collapses any range kept
 * from the selection. The range is kept while it still holds the passage,
 * otherwise the passage is found again by its text.
 */
export const livePassageRange = (
	scope: ParentNode,
	passage: { eventId: string; text: string },
	range: Range | null
): Range | null => {
	if (
		range &&
		!range.collapsed &&
		range.startContainer.isConnected &&
		normalizePassage(range.toString()) === normalizePassage(passage.text)
	) {
		return range;
	}
	const bubble = findMessageBubble(scope, passage.eventId);
	return bubble ? findPassageRange(bubble, passage.text) : null;
};

/**
 * Paints the passage and keeps it painted through re-renders of its
 * message. Returns a cleanup.
 */
export const paintLivePassage = (
	name: string,
	scope: ParentNode,
	passage: { eventId: string; text: string },
	range: Range | null
): (() => void) => {
	let current = livePassageRange(scope, passage, range);
	let clearPaint = paintPassage(name, current);
	const bubble = findMessageBubble(scope, passage.eventId);
	const observer =
		bubble && typeof MutationObserver !== 'undefined'
			? new MutationObserver(() => {
					const next = livePassageRange(scope, passage, current);
					if (next !== current) {
						current = next;
						clearPaint();
						clearPaint = paintPassage(name, current);
					}
				})
			: null;
	observer?.observe(bubble!, {
		subtree: true,
		childList: true,
		characterData: true
	});
	return () => {
		observer?.disconnect();
		clearPaint();
	};
};

export const JUMP_HIGHLIGHT = 'oriso-selection-reply-jump';
export const ACTIVE_HIGHLIGHT = 'oriso-selection-reply-active';
/** The passage a thread was started on, painted on the thread's root. */
export const THREAD_HIGHLIGHT = 'oriso-selection-reply-thread';
const JUMP_TARGET_CLASS = 'messageItem__message--jumpTarget';
export const JUMP_HOLD_MS = 2400;

/**
 * Brings the quoted passage back into view: scrolls its message to the
 * middle, paints the passage and rings the bubble for a moment, and moves
 * focus to the message so a keyboard user lands where the eye does.
 */
export const jumpToPassage = (
	scope: ParentNode,
	eventId: string,
	passage: string
): (() => void) => {
	const bubble = findMessageBubble(scope, eventId);
	if (!bubble) {
		return () => {};
	}
	const reduceMotion =
		typeof window.matchMedia === 'function' &&
		window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	bubble.scrollIntoView({
		behavior: reduceMotion ? 'auto' : 'smooth',
		block: 'center'
	});
	// Focus lands on the bubble itself, not its full-width row: the ring
	// follows the bubble's shape (selectionReply.styles.scss).
	if (!bubble.hasAttribute('tabindex')) {
		bubble.setAttribute('tabindex', '-1');
	}
	bubble.setAttribute('data-jump-focus', '');
	bubble.focus({ preventScroll: true });
	bubble.classList.remove(JUMP_TARGET_CLASS);
	// Restart the ring animation when the same quote is clicked twice.
	void bubble.offsetWidth;
	bubble.classList.add(JUMP_TARGET_CLASS);
	// A long message is shown shortened; when the passage sits in the hidden
	// part, open the message and paint once React has rendered the full text.
	let clearPaint: () => void = () => {};
	let frame = 0;
	const range = findPassageRange(bubble, passage);
	const expand = bubble.querySelector<HTMLButtonElement>(
		'.messageItem__expandBtn[aria-expanded="false"]'
	);
	if (!range && expand) {
		expand.click();
		frame = window.requestAnimationFrame(() => {
			clearPaint = paintPassage(
				JUMP_HIGHLIGHT,
				findPassageRange(bubble, passage)
			);
		});
	} else {
		clearPaint = paintPassage(JUMP_HIGHLIGHT, range);
	}
	const timer = window.setTimeout(() => {
		clearPaint();
		bubble.classList.remove(JUMP_TARGET_CLASS);
	}, JUMP_HOLD_MS);
	return () => {
		window.cancelAnimationFrame(frame);
		window.clearTimeout(timer);
		clearPaint();
		bubble.classList.remove(JUMP_TARGET_CLASS);
	};
};
