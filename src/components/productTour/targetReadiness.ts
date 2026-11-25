export interface WaitForTargetOptions {
	timeoutMs: number;
	pollMs?: number;
}

/**
 * Waits until a selector matches an element or the bounded timeout elapses.
 * Resolves `true` when found, `false` on timeout — it never rejects, so a
 * missing tour target can be skipped without trapping the user in an overlay.
 */
export const waitForTarget = (
	selector: string,
	{ timeoutMs, pollMs = 50 }: WaitForTargetOptions
): Promise<boolean> =>
	new Promise((resolve) => {
		const deadline = Date.now() + timeoutMs;
		const check = () => {
			let target: Element | null;
			try {
				target = document.querySelector(selector);
			} catch {
				// An invalid selector can never match: keep the never-reject
				// contract and let the caller skip the step safely.
				resolve(false);
				return;
			}
			if (target) {
				resolve(true);
			} else if (Date.now() >= deadline) {
				resolve(false);
			} else {
				setTimeout(check, pollMs);
			}
		};
		check();
	});

/**
 * Scrolls a target into its scroll container when it lies outside the
 * viewport (FE#2340: the long profile and settings pages render every card
 * of a tab, so a tour target can sit below the fold). Joyride's own scroll
 * stays off (`skipScroll`): it scrolls the window, which would break the
 * fixed app shell; `scrollIntoView` moves the nearest scrolling pane.
 */
/**
 * A scrolling ancestor (FE#2545: the Zeitstrahl's chip row) can cut a
 * target off although the target lies inside the window. Only containers
 * the counsellor can scroll count; one that merely hides its overflow is a
 * layout choice, not a hiding place.
 */
const cutOffByScroller = (target: Element, rect: DOMRect): boolean => {
	for (
		let parent = target.parentElement;
		parent && parent !== document.body;
		parent = parent.parentElement
	) {
		const { overflowX, overflowY } = getComputedStyle(parent);
		const scrollsX =
			/auto|scroll/.test(overflowX) &&
			parent.scrollWidth > parent.clientWidth;
		const scrollsY =
			/auto|scroll/.test(overflowY) &&
			parent.scrollHeight > parent.clientHeight;
		if (!scrollsX && !scrollsY) continue;
		const box = parent.getBoundingClientRect();
		if (
			(scrollsX &&
				(rect.left < box.left - 1 || rect.right > box.right + 1)) ||
			(scrollsY &&
				(rect.top < box.top - 1 || rect.bottom > box.bottom + 1))
		) {
			return true;
		}
	}
	return false;
};

export const bringTargetIntoView = (target: Element | null): void => {
	if (!target) return;
	const rect = target.getBoundingClientRect();
	const outside =
		rect.top < 0 ||
		rect.left < 0 ||
		rect.bottom > window.innerHeight ||
		rect.right > window.innerWidth;
	if (outside) {
		// A target taller than the screen is shown from its top; centring it
		// would push its start (and the tooltip's anchor) out of view.
		const tall = rect.bottom - rect.top > window.innerHeight;
		target.scrollIntoView({
			block: tall ? 'start' : 'center',
			inline: 'nearest'
		});
	} else if (cutOffByScroller(target, rect)) {
		// At once: the chip row scrolls smoothly, and the spotlight is
		// measured right after this call.
		target.scrollIntoView({
			block: 'nearest',
			inline: 'nearest',
			behavior: 'instant'
		});
	}
};
