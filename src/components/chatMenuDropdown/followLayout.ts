/**
 * Calls `update` whenever something may have moved the given elements:
 * scrolling, resizing, and the end of an animation (transforms move boxes
 * without resizing them). Returns the unsubscribe.
 */
export const followLayout = (
	update: () => void,
	elements: ReadonlyArray<Element | null | undefined>
): (() => void) => {
	const observer =
		typeof ResizeObserver === 'undefined'
			? null
			: new ResizeObserver(update);
	for (const element of elements) {
		if (element) observer?.observe(element);
	}
	window.addEventListener('resize', update);
	window.addEventListener('scroll', update, true);
	window.addEventListener('animationend', update, true);
	return () => {
		observer?.disconnect();
		window.removeEventListener('resize', update);
		window.removeEventListener('scroll', update, true);
		window.removeEventListener('animationend', update, true);
	};
};
