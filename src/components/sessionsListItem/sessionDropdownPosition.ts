const DROPDOWN_WIDTH = 301;
const DROPDOWN_MARGIN = 12;
const DROPDOWN_GAP = 8;

export type DropdownAnchorRect = Pick<DOMRect, 'bottom' | 'right'>;

export const getSessionDropdownPosition = (
	rect: DropdownAnchorRect,
	viewportWidth: number
) => {
	const maxLeft = Math.max(
		DROPDOWN_MARGIN,
		viewportWidth - DROPDOWN_WIDTH - DROPDOWN_MARGIN
	);
	const preferredLeft = rect.right - DROPDOWN_WIDTH;

	return {
		top: rect.bottom + DROPDOWN_GAP,
		left: Math.min(Math.max(DROPDOWN_MARGIN, preferredLeft), maxLeft)
	};
};
