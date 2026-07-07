export type MenuDirection = 'up' | 'down';

/**
 * Figma TipTap menu rule (node 7086:46390): use a bottom-to-top approach for
 * docked/minimized menus, as space is limited. In the maximized editor —
 * desktop and mobile alike — every menu opens from the top down.
 */
export const getMenuDirection = ({
	isExpanded
}: {
	isExpanded: boolean;
	isMobile?: boolean;
}): MenuDirection => (isExpanded ? 'down' : 'up');
