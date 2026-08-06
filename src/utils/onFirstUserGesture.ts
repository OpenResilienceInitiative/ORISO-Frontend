/**
 * Run a callback ONCE on the user's first pointer/keyboard gesture — the
 * shared scaffold behind the Safari audio unlock and the gesture-based
 * notification-permission request (#576 review). Returns a cleanup function
 * that removes the listeners without firing.
 */
export const onFirstUserGesture = (
	callback: () => void,
	target: EventTarget = window
): (() => void) => {
	const remove = () => {
		target.removeEventListener('pointerdown', fire, true);
		target.removeEventListener('keydown', fire, true);
	};
	const fire = () => {
		remove();
		callback();
	};
	target.addEventListener('pointerdown', fire, true);
	target.addEventListener('keydown', fire, true);
	return remove;
};
