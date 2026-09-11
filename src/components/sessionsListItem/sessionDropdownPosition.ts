const DROPDOWN_WIDTH = 301;
const DROPDOWN_MARGIN = 12;
const DROPDOWN_GAP = 8;

/** Mirrors the `width` of `.sessionsListItem__handoverActionMenu`. */
export const HANDOVER_MENU_WIDTH = 236;

export type DropdownAnchorRect = Pick<DOMRect, 'bottom' | 'right'>;

export const getSessionDropdownPosition = (
	rect: DropdownAnchorRect,
	viewportWidth: number,
	dropdownWidth: number = DROPDOWN_WIDTH
) => {
	const maxLeft = Math.max(
		DROPDOWN_MARGIN,
		viewportWidth - dropdownWidth - DROPDOWN_MARGIN
	);
	const preferredLeft = rect.right - dropdownWidth;

	return {
		top: rect.bottom + DROPDOWN_GAP,
		left: Math.min(Math.max(DROPDOWN_MARGIN, preferredLeft), maxLeft)
	};
};
