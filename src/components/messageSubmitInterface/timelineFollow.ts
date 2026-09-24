/**
 * Does the timeline follow a new message, or does the arrow announce it?
 *
 * Frank (14.09.): "wenn ich nichts angeklickt habe, [soll es] zur neuesten
 * einfach hinspringen. Und wenn ich was schreibe, dann [zeig] mir das halt
 * in dem Pfeil an." So: the reader who has not scrolled away and is not
 * writing gets carried along; the one who IS writing keeps their place and
 * the composer's scroll-to-newest arrow lights up instead. A reader who
 * scrolled up is already away from the bottom — the follow predicate
 * leaves them there.
 */

/**
 * How far from the true bottom still counts as "at the bottom".
 *
 * The old check allowed ±1 px. The composer is absolutely positioned over
 * the timeline and the timeline reserves room for it in `padding-bottom`;
 * every composer resize (auto-grow while typing, drag handle, an info bar
 * appearing) moves that floor by whole pixels and fractional layout heights
 * miss a 1 px window routinely — after which the view silently stopped
 * following new messages.
 */
export const BOTTOM_TOLERANCE_PX = 32;

export interface TimelineScrollMetrics {
	scrollTop: number;
	scrollHeight: number;
	clientHeight: number;
}

export const isTimelineAtBottom = (
	{ scrollTop, scrollHeight, clientHeight }: TimelineScrollMetrics,
	tolerance: number = BOTTOM_TOLERANCE_PX
): boolean => scrollHeight - (scrollTop + clientHeight) <= tolerance;

export interface FollowDecision {
	/** The message that just arrived is the reader's own. */
	isOwnMessage: boolean;
	/** The timeline was resting at its end before the message arrived. */
	atBottom: boolean;
	/** The reader is writing: focused composer or a non-empty draft. */
	isComposing: boolean;
}

/** `true` → scroll to the newest message; `false` → light the arrow. */
export const shouldFollowNewMessage = ({
	isOwnMessage,
	atBottom,
	isComposing
}: FollowDecision): boolean => {
	if (isOwnMessage) {
		return true;
	}
	return atBottom && !isComposing;
};

/**
 * After declining to follow an arrival, the "at bottom" flag is stale:
 * appending a row fires no scroll event. Composer growth must not treat
 * that flag as permission to scroll. Keep it during the first paint so an
 * empty timeline can still follow the first remote message.
 */
export const shouldClearAtBottomAfterSuppressedFollow = ({
	initialScrollCompleted,
	followed,
	atBottom
}: {
	initialScrollCompleted: boolean;
	followed: boolean;
	atBottom: boolean;
}): boolean => initialScrollCompleted && !followed && atBottom;

/**
 * The first paint of a timeline is not unread: the view is about to jump
 * there. Count only arrivals after that scroll has finished.
 */
export const unreadCountAfterArrival = (
	messageCount: number,
	baselineCount: number,
	initialScrollCompleted: boolean
): number =>
	initialScrollCompleted
		? Math.max(0, messageCount - (baselineCount || 0))
		: 0;

/**
 * Set on the composer card while its focus is the one the app placed by
 * itself (the desktop autofocus when a chat opens). A click, a keystroke or
 * leaving the card removes it.
 */
export const AUTO_FOCUS_ATTRIBUTE = 'data-auto-focused';

/**
 * Run the app's own focus call and mark the card if that call is what put
 * the cursor there. A focus the person already placed stays unmarked.
 */
export const focusComposerAutomatically = (
	composerCard: Element | null | undefined,
	focus: () => void
): void => {
	const hadFocus =
		!!composerCard && composerCard.contains(document.activeElement);
	focus();
	if (
		composerCard &&
		!hadFocus &&
		composerCard.contains(document.activeElement)
	) {
		composerCard.setAttribute(AUTO_FOCUS_ATTRIBUTE, '');
	}
};

/**
 * "Is the reader writing?" — they clicked or typed into the composer card
 * (it has focus the app did not place by itself), or it holds a draft.
 * Frank (16.09.): the automatic cursor alone is not writing. Pure so the
 * rule can be tested without a chat; the caller hands in the composer card
 * element and the document's active element.
 */
export const isComposerBusy = (
	composerCard: Element | null | undefined,
	activeElement: Element | null
): boolean => {
	if (!composerCard) {
		return false;
	}
	if (
		activeElement &&
		composerCard.contains(activeElement) &&
		!composerCard.hasAttribute(AUTO_FOCUS_ATTRIBUTE)
	) {
		return true;
	}
	const editor = composerCard.querySelector(
		'.tiptap, [contenteditable="true"]'
	);
	return (editor?.textContent ?? '').trim().length > 0;
};
