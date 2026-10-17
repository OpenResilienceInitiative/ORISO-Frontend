import { transitionMotion } from '../transitionMotion';

/**
 * Where the closing animation ends. A room declares one of these names; it
 * never points at an element itself, so every room ends the same way.
 *
 * - `messageField`: a standard counselling chat. The person arrives and can
 *   type at once.
 * - `call`: a video call has its own focal point, the main area of the call.
 *
 * The destination marks its own element with `data-closing-focal`. The room is
 * already gone when the animation looks for it, which is why it is looked up
 * by attribute and not handed over as a reference.
 */
export type ClosingFocal = 'messageField' | 'call';

export const CLOSING_FOCAL_ATTRIBUTE = 'data-closing-focal';

export const CLOSING_FOCAL_SELECTOR: Record<ClosingFocal, string> = {
	messageField: `[${CLOSING_FOCAL_ATTRIBUTE}="message-field"]`,
	call: `[${CLOSING_FOCAL_ATTRIBUTE}="call"]`
};

export interface FocalPoint {
	x: number;
	y: number;
	/** The element that was found; `null` when the fallback point is used. */
	element: HTMLElement | null;
}

/** Where to end when the destination never shows its focal element. */
const fallbackPoint = (win: Window): FocalPoint => ({
	x: win.innerWidth / 2,
	y: win.innerHeight * 0.82,
	element: null
});

const centreOf = (element: HTMLElement): FocalPoint | null => {
	const rect = element.getBoundingClientRect();
	if (!rect.width || !rect.height) {
		return null;
	}
	return {
		x: rect.left + rect.width / 2,
		y: rect.top + rect.height / 2,
		element
	};
};

/**
 * Finds the destination's focal element, waiting for it to appear after the
 * room was swapped. Gives up after `waitMs` (`transitionMotion.closing.focalWaitMs`
 * unless the destination is a new document, which needs longer) and
 * returns the fallback point, so a destination without a marked element only
 * costs the animation its precision, never the person their arrival. `isOver`
 * tells it the animation was cut short (the cap) and nobody needs the answer.
 */
export const resolveFocalPoint = (
	doc: Document,
	focal: ClosingFocal,
	isOver: () => boolean = () => false,
	waitMs: number = transitionMotion.closing.focalWaitMs
): Promise<FocalPoint> => {
	const win = doc.defaultView as Window;
	const deadline = Date.now() + waitMs;
	return new Promise((resolve) => {
		const look = () => {
			if (isOver()) {
				resolve(fallbackPoint(win));
				return;
			}
			const element = doc.querySelector<HTMLElement>(
				CLOSING_FOCAL_SELECTOR[focal]
			);
			const found = element ? centreOf(element) : null;
			if (found) {
				resolve(found);
				return;
			}
			if (Date.now() >= deadline) {
				resolve(fallbackPoint(win));
				return;
			}
			win.requestAnimationFrame(look);
		};
		look();
	});
};
