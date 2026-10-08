export type MenuDirection = 'up' | 'down';

/**
 * Preferred opening direction for a composer toolbar menu.
 *
 * Figma TipTap menu rule (node 7086:46390): docked/minimised menus open
 * bottom-to-top because space is limited; the maximised editor opens them
 * top-down.
 *
 * This is a *preference*, not a guarantee (ORISO-Frontend#1250). It used to be
 * absolute, which put the ⋮ menu below a toolbar already near the bottom of a
 * phone screen and ran the last entries off the edge. `ToolbarMenu` now hands
 * this to floating-ui as the preferred placement and lets `flip()` overrule it
 * when the menu would not fit — fitting on screen beats the fixed rule.
 *
 * There is deliberately no `isMobile` parameter. One used to be accepted and
 * never read, so callers could pass it and believe it did something; the story
 * harness did exactly that and modelled a mobile behaviour the app never had,
 * which is why this defect got through review. Viewport size is a collision
 * question now, and collisions are measured rather than guessed.
 */
export const getMenuDirection = ({
	isExpanded
}: {
	isExpanded: boolean;
}): MenuDirection => (isExpanded ? 'down' : 'up');
