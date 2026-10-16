import { useCallback } from 'react';
import { useTenant } from '../../../globalState/provider/TenantProvider';
import { prefersReducedMotion } from '../useReducedMotion';
import {
	CLOSING_DESKTOP_MIN_WIDTH,
	resolveTenantClosingAnimation
} from './closingVariants';
import {
	playClosingAnimation,
	PlayClosingAnimationOptions,
	PlayClosingAnimationResult
} from './playClosingAnimation';

/**
 * The closing animation a waiting room plays when the person goes on.
 *
 * The room says only where it ends (`focal`) and what to do once the screen is
 * covered (`onCovered`). The design comes from the tenant's setting for the
 * width the person is on, and reduced motion is answered here, once, for every
 * room. Both are read at the press: nothing is subscribed to while the room
 * is on screen, and a person who rotates their phone gets the design that
 * belongs to the screen they are looking at when they press.
 */
export const useClosingAnimation = () => {
	const tenant = useTenant();

	const play = useCallback(
		(
			options: Omit<
				PlayClosingAnimationOptions,
				'variant' | 'reducedMotion'
			>
		): Promise<PlayClosingAnimationResult> => {
			const win = (options.document ?? document).defaultView ?? window;
			const desktop =
				typeof win.matchMedia === 'function' &&
				win.matchMedia(`(min-width: ${CLOSING_DESKTOP_MIN_WIDTH}px)`)
					.matches;
			return playClosingAnimation({
				...options,
				variant: resolveTenantClosingAnimation(tenant, desktop),
				reducedMotion: prefersReducedMotion(win)
			});
		},
		[tenant]
	);

	return { play };
};
