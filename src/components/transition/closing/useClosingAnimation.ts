import { useCallback } from 'react';
import { prefersReducedMotion } from '../useReducedMotion';
import {
	playClosingAnimation,
	PlayClosingAnimationOptions,
	PlayClosingAnimationResult
} from './playClosingAnimation';

/**
 * The closing animation a waiting room plays when the person goes on.
 *
 * The room says only where it ends (`focal`) and what to do once the screen is
 * covered (`onCovered`). There is one design and it always sweeps upward, so
 * the width of the screen is not asked. Reduced motion is answered here, once,
 * for every room, and is read at the press: nothing is subscribed to while the
 * room is on screen.
 */
export const useClosingAnimation = () => {
	const play = useCallback(
		(
			options: Omit<PlayClosingAnimationOptions, 'reducedMotion'>
		): Promise<PlayClosingAnimationResult> => {
			const win = (options.document ?? document).defaultView ?? window;
			return playClosingAnimation({
				...options,
				reducedMotion: prefersReducedMotion(win)
			});
		},
		[]
	);

	return { play };
};
