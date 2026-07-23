/**
 * Opening direction for the person selection menu (Figma node 8480-27986):
 * "choose according to button position where to open — if more space is on
 * top open menu on top, if more space is left on the bottom open it towards
 * the bottom". The menu gets a scrollbar when it is taller than the free
 * space on the chosen side.
 */

export type MenuDirection = 'up' | 'down';

export interface MenuPlacement {
	direction: MenuDirection;
	maxHeight: number;
}

const VIEWPORT_MARGIN = 16;

export const decideMenuPlacement = ({
	anchorTop,
	anchorBottom,
	viewportHeight,
	menuHeight
}: {
	anchorTop: number;
	anchorBottom: number;
	viewportHeight: number;
	menuHeight: number;
}): MenuPlacement => {
	const spaceAbove = Math.max(0, anchorTop - VIEWPORT_MARGIN);
	const spaceBelow = Math.max(
		0,
		viewportHeight - anchorBottom - VIEWPORT_MARGIN
	);

	if (menuHeight <= spaceBelow) {
		return { direction: 'down', maxHeight: menuHeight };
	}
	if (menuHeight <= spaceAbove) {
		return { direction: 'up', maxHeight: menuHeight };
	}
	// Menu does not fit on either side: open towards the larger space and
	// cap the height so the list scrolls inside the menu.
	return spaceAbove > spaceBelow
		? { direction: 'up', maxHeight: spaceAbove }
		: { direction: 'down', maxHeight: spaceBelow };
};
