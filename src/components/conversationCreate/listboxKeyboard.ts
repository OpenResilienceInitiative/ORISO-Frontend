/**
 * Keyboard contract for the pop-up listboxes in the create-conversation flow
 * (topic menu + person select menu). Extracted as a pure reducer so the focus
 * arithmetic is unit-testable and shared between both menus:
 *
 * - ArrowDown / ArrowUp move to the next / previous option and wrap around.
 * - Home / End jump to the first / last option.
 * - Escape closes the menu and returns focus to the trigger.
 *
 * The function returns the option index to focus next, or `'close'` for
 * Escape, or `null` when the key is not handled (so the caller leaves the
 * event alone).
 */
export type ListboxKeyResult = number | 'close' | null;

export const resolveListboxKey = (
	key: string,
	currentIndex: number,
	optionCount: number
): ListboxKeyResult => {
	if (optionCount <= 0) {
		return key === 'Escape' ? 'close' : null;
	}
	switch (key) {
		case 'ArrowDown':
			return currentIndex < 0 ? 0 : (currentIndex + 1) % optionCount;
		case 'ArrowUp':
			return currentIndex <= 0 ? optionCount - 1 : currentIndex - 1;
		case 'Home':
			return 0;
		case 'End':
			return optionCount - 1;
		case 'Escape':
			return 'close';
		default:
			return null;
	}
};
