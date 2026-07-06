export type MenuDirection = 'up' | 'down';

/**
 * Figma TipTap menu rule (node 7086:46390): use a bottom-to-top approach for
 * minimized or mobile menus, as space is limited. In fullscreen mode, display
 * the menu from the top down.
 */
export const getMenuDirection = ({
	isExpanded,
	isMobile
}: {
	isExpanded: boolean;
	isMobile: boolean;
}): MenuDirection => (isExpanded && !isMobile ? 'down' : 'up');
