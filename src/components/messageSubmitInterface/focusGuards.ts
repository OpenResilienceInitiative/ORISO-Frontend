/**
 * Focus etiquette for the composer's automatic focus (review v6).
 *
 * The composer focuses its editor a tick after the draft loads so people
 * can type straight away. That must never win against an open menu — the
 * channel card (T20) had ↓/↑ go dead when the autofocus landed after the
 * card opened. Pure DOM check, no React.
 */
export const OPEN_MENU_SELECTOR = '[role="menu"]';

/**
 * Regions that keep keyboard focus against the autofocus: an open menu,
 * and anything marked `data-keeps-focus` — the side-panel header does
 * that, because after a pick from the FAB its channel button holds focus
 * and the panel's freshly mounted composer must not pull it away.
 */
export const KEEPS_FOCUS_SELECTOR = '[role="menu"], [data-keeps-focus]';

const isInside = (
	activeElement: Element | null | undefined,
	selector: string
): boolean =>
	Boolean(
		activeElement &&
			activeElement !== document.body &&
			activeElement.closest(selector)
	);

export const isFocusInsideOpenMenu = (
	activeElement: Element | null | undefined
): boolean => isInside(activeElement, OPEN_MENU_SELECTOR);

export const isFocusProtected = (
	activeElement: Element | null | undefined
): boolean => isInside(activeElement, KEEPS_FOCUS_SELECTOR);

/**
 * Schedule the composer's normal initial focus without making that policy an
 * implicit side effect of mounting an editor. Side panels can disable this
 * one automatic hand-off when navigation has explicitly assigned focus to
 * their header; direct user focus and every later editor action are unchanged.
 */
export const scheduleComposerAutoFocus = (
	focusEditor: () => void,
	enabled = true
): (() => void) => {
	if (!enabled) {
		return () => undefined;
	}

	const timeoutId = window.setTimeout(() => {
		if (!isFocusProtected(document.activeElement)) {
			focusEditor();
		}
	}, 0);

	return () => window.clearTimeout(timeoutId);
};

/**
 * True while the person is typing somewhere outside `ownComposer` — in
 * another editor (a second composer on the same view) or a form field.
 * A composer's automatic focus must yield to that: with the chat card and
 * the supervision panel open side by side, the later composer's autofocus
 * used to pull focus out of the editor mid-word and swallow the rest.
 */
export const isTypingElsewhere = (
	activeElement: Element | null | undefined,
	ownComposer: Element | null | undefined
): boolean => {
	if (!activeElement || activeElement === document.body) {
		return false;
	}
	if (ownComposer?.contains(activeElement)) {
		return false;
	}
	const tagName = activeElement.tagName.toLowerCase();
	return (
		(activeElement as HTMLElement).isContentEditable === true ||
		// jsdom has no `isContentEditable`; the attribute says the same.
		Boolean(
			activeElement.closest(
				'[contenteditable=""], [contenteditable="true"]'
			)
		) ||
		tagName === 'input' ||
		tagName === 'textarea' ||
		tagName === 'select'
	);
};
