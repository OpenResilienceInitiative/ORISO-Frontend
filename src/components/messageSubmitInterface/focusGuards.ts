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
