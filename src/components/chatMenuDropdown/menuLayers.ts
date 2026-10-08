/**
 * Card menus portal to `document.body` and must clear every stacking context
 * of the list; the menu sits one layer above its own veil.
 */
export const CARD_MENU_BACKDROP_LAYER = 999998;
export const CARD_MENU_LAYER = CARD_MENU_BACKDROP_LAYER + 1;
