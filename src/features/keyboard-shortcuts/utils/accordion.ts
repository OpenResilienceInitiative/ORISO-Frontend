/** Exclusive accordion helpers for Settings categories. */

export type ShortcutCategoryId =
	| 'messaging'
	| 'attachments'
	| 'emoji'
	| 'application';

export const DEFAULT_EXPANDED_CATEGORY: ShortcutCategoryId = 'messaging';

/**
 * Toggle exclusive accordion: opening one closes others; clicking open one collapses to null.
 */
export const toggleExclusiveAccordion = (
	current: ShortcutCategoryId | null,
	clicked: ShortcutCategoryId
): ShortcutCategoryId | null => (current === clicked ? null : clicked);

export const isCategoryExpanded = (
	expanded: ShortcutCategoryId | null,
	category: ShortcutCategoryId
): boolean => expanded === category;
