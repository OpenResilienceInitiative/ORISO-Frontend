import { RefObject, useEffect, useRef } from 'react';

/**
 * Something is floating above the create view (a card menu, a person list, a
 * MUI dialog or popover). It owns the click or Escape; the view stays put.
 */
const OVERLAY_SELECTOR = [
	'.rowMenu',
	'.personSelectMenu',
	'.MuiModal-root:not(.MuiModal-hidden)',
	'.MuiPopover-root',
	'.MuiPopper-root',
	'[role="dialog"]',
	'[role="alertdialog"]'
].join(',');

/** Empty areas of the panel: a click there is a click on the backdrop. */
const BACKDROP_SELECTOR = [
	'.conversationCreate',
	'.conversationCreate__picker',
	'.conversationCreate__selection',
	'.conversationCreate__rows',
	'.conversationCreate__single',
	'.formatCardCarousel',
	'.formatCardCarousel__scroller'
].join(',');

/** Outside the panel only empty space counts; controls do their own job. */
const INTERACTIVE_SELECTOR = [
	'a',
	'button',
	'input',
	'select',
	'textarea',
	'label',
	'summary',
	'[role="button"]',
	'[role="link"]',
	'[role="tab"]',
	'[role="menuitem"]',
	'[role="option"]',
	'[role="checkbox"]',
	'[role="switch"]',
	'[role="combobox"]',
	'[contenteditable="true"]',
	'[tabindex]:not([tabindex="-1"])'
].join(',');

const overlayOpen = () => document.querySelector(OVERLAY_SELECTOR) !== null;

/**
 * The create view is a panel beside the conversation list, not a modal, yet
 * it has to be leavable like one: a click into empty space (inside the panel
 * around the cards, or outside it) and Escape ask `onDismiss` to close it.
 *
 * - Clicks on cards and on any control stay theirs; the list, the search and
 *   the icon row behind the panel keep working.
 * - A press that starts on a card and is released on the backdrop (selecting
 *   text, dragging a slider) is not a click on the backdrop.
 * - While a menu, popover or dialog is open it owns the click and Escape.
 */
export const useDismissOnOutside = (
	surfaceRef: RefObject<HTMLElement | null>,
	onDismiss: () => void
) => {
	const dismissRef = useRef(onDismiss);
	dismissRef.current = onDismiss;

	useEffect(() => {
		let pressTarget: EventTarget | null = null;
		let overlayAtPress = false;

		const handlePointerDown = (event: PointerEvent | MouseEvent) => {
			// pointerdown and mousedown of one press carry the same target.
			pressTarget = event.target;
			overlayAtPress = overlayOpen();
		};

		const handleClick = (event: MouseEvent) => {
			const startedOn = pressTarget;
			const hadOverlay = overlayAtPress;
			pressTarget = null;
			overlayAtPress = false;
			const target = event.target;
			if (
				!(target instanceof Element) ||
				event.defaultPrevented ||
				event.button !== 0 ||
				hadOverlay ||
				overlayOpen() ||
				(startedOn !== null && startedOn !== target)
			) {
				return;
			}
			if (!target.isConnected) {
				return;
			}
			const surface = surfaceRef.current;
			if (!surface) {
				return;
			}
			const insidePanel = surface.contains(target);
			if (insidePanel) {
				if (target.closest(BACKDROP_SELECTOR) === target) {
					dismissRef.current();
				}
				return;
			}
			if (!target.closest(INTERACTIVE_SELECTOR)) {
				dismissRef.current();
			}
		};

		const handleKeyDown = (event: KeyboardEvent) => {
			if (
				event.key !== 'Escape' ||
				event.defaultPrevented ||
				event.isComposing ||
				overlayOpen()
			) {
				return;
			}
			dismissRef.current();
		};

		document.addEventListener('pointerdown', handlePointerDown, true);
		document.addEventListener('mousedown', handlePointerDown, true);
		document.addEventListener('click', handleClick);
		document.addEventListener('keydown', handleKeyDown);
		return () => {
			document.removeEventListener(
				'pointerdown',
				handlePointerDown,
				true
			);
			document.removeEventListener('mousedown', handlePointerDown, true);
			document.removeEventListener('click', handleClick);
			document.removeEventListener('keydown', handleKeyDown);
		};
	}, [surfaceRef]);
};
