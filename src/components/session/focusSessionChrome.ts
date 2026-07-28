import type { MouseEvent, PointerEvent } from 'react';

/**
 * Focus the session/enquiry chrome on pointer-down outside the composer so
 * `:focus-within:not(:has(.textarea__wrapper-send-message--selected))` can
 * drive the #597 active border. Leaves native focus alone for the composer
 * and other interactive controls.
 */
const COMPOSER_FOCUS_GUARD =
	'.textarea, .messageSubmit__wrapper, .textarea__wrapper-send-message, [contenteditable="true"], [role="textbox"]';

const NATIVE_FOCUS_TARGET =
	'a, button, input, textarea, select, summary, [tabindex]:not([tabindex="-1"])';

export const focusSessionChromeOnPointerDown = (
	event: PointerEvent<HTMLElement> | MouseEvent<HTMLElement>
): void => {
	const target = event.target as HTMLElement | null;
	if (!target?.closest) {
		return;
	}
	if (target.closest(COMPOSER_FOCUS_GUARD)) {
		return;
	}
	if (target.closest(NATIVE_FOCUS_TARGET)) {
		return;
	}
	event.currentTarget.focus({ preventScroll: true });
};
