/**
 * Finding a marked passage again inside a rendered message bubble.
 *
 * The selection's `toString()` and the bubble's text nodes disagree on
 * whitespace (line breaks, `<br>`, collapsed spaces), so both sides are
 * compared with runs of whitespace collapsed to one space. The in-bubble
 * quote of an earlier reply and the passage replies above the body are
 * skipped: a passage always belongs to the message's own text.
 */

// A blurred passage is aria-hidden but still counts: its scrambled text has
// the same shape as the original, so offsets stay stable. Its screen-reader
// label does not count.
const SKIP_SELECTOR =
	'.messageItem__replyQuote, .messageItem__passageReplies, button, [aria-hidden="true"]:not(.passageBlur), .passageBlur__srLabel, .messageItem__metaData, .messageItem__timeRail, .messageItem__reactions';

export const normalizePassage = (text: string): string =>
	text.replace(/\s+/g, ' ').trim();

/**
 * One character of the collected text. `virtual` marks the space a line break
 * (`<br>`, a new paragraph) stands for: it has no character in the DOM and
 * points at the first character after the break.
 */
export type Mapped = { node: Text; offset: number; virtual?: true };

// Elements that start a new rendered line.
const BLOCK_SELECTOR =
	'p, div, li, ul, ol, blockquote, pre, h1, h2, h3, h4, h5, h6, table, tr, td, th';

/**
 * The bubble's own text with whitespace collapsed, plus where each character
 * sits in the DOM. A line break counts as one space, as in the selection's
 * text, so a passage across paragraphs is found again.
 */
export const collectText = (root: Element): { text: string; map: Mapped[] } => {
	const map: Mapped[] = [];
	let text = '';
	let lastWasSpace = true;
	let pendingBreak = false;
	let lastBlock: Element | null | undefined;
	const walker = root.ownerDocument.createTreeWalker(
		root,
		NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
		{
			acceptNode: (node) => {
				if (node.nodeType === Node.ELEMENT_NODE) {
					const element = node as Element;
					if (element.closest(SKIP_SELECTOR)) {
						return NodeFilter.FILTER_REJECT;
					}
					return element.tagName === 'BR'
						? NodeFilter.FILTER_ACCEPT
						: NodeFilter.FILTER_SKIP;
				}
				return node.parentElement?.closest(SKIP_SELECTOR)
					? NodeFilter.FILTER_REJECT
					: NodeFilter.FILTER_ACCEPT;
			}
		}
	);
	let next = walker.nextNode();
	while (next) {
		if (next.nodeType === Node.ELEMENT_NODE) {
			pendingBreak = true;
			next = walker.nextNode();
			continue;
		}
		const current = next as Text;
		const block = current.parentElement?.closest(BLOCK_SELECTOR) ?? null;
		if (lastBlock !== undefined && block !== lastBlock) {
			pendingBreak = true;
		}
		lastBlock = block;
		const value = current.data;
		if (pendingBreak && !lastWasSpace && value.trim()) {
			text += ' ';
			map.push({ node: current, offset: 0, virtual: true });
			lastWasSpace = true;
		}
		if (value.trim()) {
			pendingBreak = false;
		}
		for (let offset = 0; offset < value.length; offset++) {
			const isSpace = /\s/.test(value[offset]);
			if (isSpace && lastWasSpace) {
				continue;
			}
			text += isSpace ? ' ' : value[offset];
			map.push({ node: current, offset });
			lastWasSpace = isSpace;
		}
		next = walker.nextNode();
	}
	return { text, map };
};

/**
 * The DOM range of `passage` inside `root`, or null when it is not there.
 * When the text repeats, `near` (where the marked passage started, in the
 * collapsed text) picks the occurrence that was marked.
 */
export const findPassageRange = (
	root: Element,
	passage: string,
	near?: number | null
): Range | null => {
	const wanted = normalizePassage(passage);
	if (!wanted) {
		return null;
	}
	const { text, map } = collectText(root);
	let start = text.indexOf(wanted);
	if (start < 0) {
		return null;
	}
	if (typeof near === 'number') {
		for (
			let next = text.indexOf(wanted, start + 1);
			next >= 0;
			next = text.indexOf(wanted, next + 1)
		) {
			if (Math.abs(next - near) < Math.abs(start - near)) {
				start = next;
			}
		}
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
	passage: { eventId: string; text: string; start?: number | null },
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
	return bubble
		? findPassageRange(bubble, passage.text, passage.start)
		: null;
};

/** The nearest ancestor that scrolls vertically, or null for the page. */
const scrollParentOf = (element: Element): HTMLElement | null => {
	for (let node = element.parentElement; node; node = node.parentElement) {
		const { overflowY } = window.getComputedStyle(node);
		if (
			/(auto|scroll|overlay)/.test(overflowY) &&
			node.scrollHeight > node.clientHeight
		) {
			return node;
		}
	}
	return null;
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
	passage: string,
	/** Where the passage started in its message, to tell repeats apart. */
	near?: number | null
): (() => void) => {
	const bubble = findMessageBubble(scope, eventId);
	if (!bubble) {
		return () => {};
	}
	const reduceMotion =
		typeof window.matchMedia === 'function' &&
		window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const behavior: ScrollBehavior = reduceMotion ? 'auto' : 'smooth';
	// Center the passage itself, by its own geometry: in a long message,
	// even within one long paragraph, the bubble's middle can be far off.
	const scrollTo = (target: Range) => {
		const rect = target.getBoundingClientRect?.();
		if (!rect) {
			bubble.scrollIntoView({ behavior, block: 'center' });
			return;
		}
		const scroller = scrollParentOf(bubble);
		const view = scroller
			? scroller.getBoundingClientRect()
			: { top: 0, height: window.innerHeight };
		const delta = rect.top + rect.height / 2 - (view.top + view.height / 2);
		(scroller ?? window).scrollBy({ top: delta, behavior });
	};
	const range = findPassageRange(bubble, passage, near);
	if (!range) {
		bubble.scrollIntoView({ behavior, block: 'center' });
	}
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
	const expand = bubble.querySelector<HTMLButtonElement>(
		'.messageItem__expandBtn[aria-expanded="false"]'
	);
	if (!range && expand) {
		expand.click();
		frame = window.requestAnimationFrame(() => {
			const opened = findPassageRange(bubble, passage, near);
			if (opened) {
				scrollTo(opened);
			}
			clearPaint = paintPassage(JUMP_HIGHLIGHT, opened);
		});
	} else {
		if (range) {
			scrollTo(range);
		}
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
