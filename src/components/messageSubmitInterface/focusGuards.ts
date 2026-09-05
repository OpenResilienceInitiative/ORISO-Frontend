/**
 * Focus etiquette for the composer's automatic focus (review v6).
 *
 * The composer focuses its editor a tick after the draft loads so people
 * can type straight away. That must never win against an open menu — the
 * channel card (T20) had ↓/↑ go dead when the autofocus landed after the
 * card opened. Pure DOM check, no React.
 */
export const OPEN_MENU_SELECTOR = '[role="menu"]';

export const isFocusInsideOpenMenu = (
	activeElement: Element | null | undefined
): boolean =>
	Boolean(
		activeElement &&
			activeElement !== document.body &&
			activeElement.closest(OPEN_MENU_SELECTOR)
	);
