import React from 'react';
import { createPortal } from 'react-dom';
import { useMenuEffects } from '../../features/menu-effects/useMenuEffects';
import { followLayout } from './followLayout';

type Hole = {
	left: number;
	top: number;
	right: number;
	bottom: number;
	radius: number;
	/** The veil covers the viewport; its clip path is drawn in its size. */
	viewportWidth: number;
	viewportHeight: number;
};

/**
 * The veil as a clip path with one rounded hole, transparent to paint and clicks.
 * The outer rect must not exceed the viewport: Chromium then paints the veil over the hole.
 */
export const spotlightClipPath = ({
	left,
	top,
	right,
	bottom,
	radius,
	viewportWidth,
	viewportHeight
}: Hole): string => {
	const r = Math.max(
		0,
		Math.min(radius, (right - left) / 2, (bottom - top) / 2)
	);
	const arc = (x: number, y: number) => `A${r} ${r} 0 0 0 ${x} ${y}`;
	return (
		`path(evenodd, "M0 0H${viewportWidth}V${viewportHeight}H0Z` +
		`M${left + r} ${top}${arc(left, top + r)}` +
		`V${bottom - r}${arc(left + r, bottom)}` +
		`H${right - r}${arc(right, bottom - r)}` +
		`V${top + r}${arc(right - r, top)}Z")`
	);
};

const readHole = (element: HTMLElement): Hole => {
	const box = element.getBoundingClientRect();
	return {
		left: box.left,
		top: box.top,
		right: box.right,
		bottom: box.bottom,
		radius:
			Number.parseFloat(getComputedStyle(element).borderTopLeftRadius) ||
			0,
		viewportWidth: window.innerWidth,
		viewportHeight: window.innerHeight
	};
};

/** Follows the spotlit element through scrolling and resizing. */
const useHole = (
	element: HTMLElement | null | undefined,
	active: boolean
): Hole | null => {
	const [hole, setHole] = React.useState<Hole | null>(null);
	React.useLayoutEffect(() => {
		if (!active || !element) {
			setHole(null);
			return undefined;
		}
		const update = () => setHole(readHole(element));
		update();
		return followLayout(update, [element]);
	}, [active, element]);
	return hole;
};

/**
 * Decorative scrim; the menu owns keyboard/focus handling. `spotlightRef` stays
 * uncovered via a clip-path hole, since the list's stacking contexts forbid lifting it.
 * Storybook: https://dev.oriso.org/storybook-frontend/?path=/story/components-session-list-sessionlistitem--menu-beside-the-card
 */
export const MenuBackdrop = ({
	open,
	onClose,
	zIndex = 99998,
	spotlightRef
}: {
	open: boolean;
	onClose: () => void;
	zIndex?: number;
	spotlightRef?: React.RefObject<HTMLElement | null>;
}) => {
	const { enabled, motionEnabled } = useMenuEffects();
	const hole = useHole(spotlightRef?.current, open && enabled);
	if (!open || !enabled) return null;
	return createPortal(
		<div
			aria-hidden="true"
			className={`orisoMenuBackdrop${motionEnabled ? ' orisoMenuBackdrop--animated' : ''}`}
			style={{
				zIndex,
				...(hole ? { clipPath: spotlightClipPath(hole) } : {})
			}}
			onMouseDown={(event) => {
				event.stopPropagation();
				onClose();
			}}
		/>,
		document.body
	);
};
