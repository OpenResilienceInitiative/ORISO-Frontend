/**
 * Whether the docked composer inside `containerRef` currently has focus.
 *
 * On the phone the channel switcher FAB hides while the person types: the
 * composer grows upwards and would otherwise push the FAB over the last
 * bubble (stage v3 review, 05.09.). Focus is tracked on the container so it
 * also covers the toolbar buttons and the send button of the same composer.
 */
import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

export const COMPOSER_SHELL_SELECTOR = '.textarea__wrapper-send-message';

export const useComposerFocus = (
	containerRef: RefObject<HTMLElement | null>
): boolean => {
	const [focused, setFocused] = useState(false);

	useEffect(() => {
		const container = containerRef.current;
		if (!container) {
			return undefined;
		}
		const isComposerTarget = (target: EventTarget | null) =>
			target instanceof Element &&
			target.closest(COMPOSER_SHELL_SELECTOR) !== null;
		const onFocusIn = (event: FocusEvent) => {
			if (isComposerTarget(event.target)) {
				setFocused(true);
			}
		};
		const onFocusOut = (event: FocusEvent) => {
			// Focus moving within the composer (editor → toolbar) keeps it.
			if (
				isComposerTarget(event.target) &&
				!isComposerTarget(event.relatedTarget)
			) {
				setFocused(false);
			}
		};
		container.addEventListener('focusin', onFocusIn);
		container.addEventListener('focusout', onFocusOut);
		return () => {
			container.removeEventListener('focusin', onFocusIn);
			container.removeEventListener('focusout', onFocusOut);
		};
	}, [containerRef]);

	return focused;
};
