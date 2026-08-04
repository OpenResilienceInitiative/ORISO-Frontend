import * as React from 'react';
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { decideMenuPlacement, MenuDirection } from './menuDirection';

/**
 * Anchored menu layer for the create-conversation cards (Figma annotation
 * "menu must show on top not inside the card").
 *
 * The format cards clip their content (`overflow: hidden` gives them their
 * rounded corners), so a menu positioned inside the card is cut off at the
 * card edge. Both menus are therefore portalled to the body and positioned
 * against their trigger with fixed coordinates — they float on top of the
 * card instead of growing inside it.
 */

const MENU_GAP = 8;

export interface AnchoredMenuLayout {
	direction: MenuDirection;
	style: React.CSSProperties;
}

export const useAnchoredMenuLayout = (
	anchorRef: React.RefObject<HTMLElement>,
	preferredHeight: number,
	/** Re-measure whenever the menu content changes its natural height. */
	contentKey: unknown
): AnchoredMenuLayout => {
	const [layout, setLayout] = useState<AnchoredMenuLayout>({
		direction: 'down',
		style: { visibility: 'hidden' }
	});

	const measure = useCallback(() => {
		const anchor = anchorRef.current;
		if (!anchor) {
			return false;
		}
		const rect = anchor.getBoundingClientRect();
		const placement = decideMenuPlacement({
			anchorTop: rect.top,
			anchorBottom: rect.bottom,
			viewportHeight: window.innerHeight,
			menuHeight: preferredHeight
		});
		setLayout({
			direction: placement.direction,
			style: {
				left: rect.left,
				maxHeight: placement.maxHeight,
				position: 'fixed',
				width: rect.width,
				...(placement.direction === 'down'
					? { top: rect.bottom + MENU_GAP }
					: { bottom: window.innerHeight - rect.top + MENU_GAP })
			}
		});
		return true;
	}, [anchorRef, preferredHeight]);

	useLayoutEffect(() => {
		if (measure()) {
			return;
		}
		// React attaches refs child-first, so an anchor that is an ancestor of
		// the menu is still null here. Retry once the commit has finished
		// instead of leaving the menu parked off-screen.
		const frame = requestAnimationFrame(() => measure());
		return () => cancelAnimationFrame(frame);
	}, [measure, contentKey]);

	// Fixed coordinates do not travel with the card, so re-anchor the menu
	// whenever anything moves it: window resize and any scrolling ancestor
	// (the flow itself scrolls, hence the capturing listener).
	useEffect(() => {
		window.addEventListener('resize', measure);
		window.addEventListener('scroll', measure, true);
		return () => {
			window.removeEventListener('resize', measure);
			window.removeEventListener('scroll', measure, true);
		};
	}, [measure]);

	return layout;
};

export const MenuPortal = ({ children }: { children: React.ReactNode }) =>
	typeof document === 'undefined'
		? null
		: createPortal(children, document.body);
