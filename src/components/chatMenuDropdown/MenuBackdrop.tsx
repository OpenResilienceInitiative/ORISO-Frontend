import React from 'react';
import { createPortal } from 'react-dom';
import { useMenuEffects } from '../../features/menu-effects/useMenuEffects';

type Hole = {
	left: number;
	top: number;
	right: number;
	bottom: number;
	radius: number;
};

/** Far outside any viewport, so the veil never needs to know its size. */
const VEIL_EDGE = 100000;

/**
 * The veil as a clip path with one rounded hole — the element the menu
 * belongs to. `evenodd` keeps the hole transparent to paint and to clicks.
 */
export const spotlightClipPath = ({
	left,
	top,
	right,
	bottom,
	radius
}: Hole): string => {
	const r = Math.max(
		0,
		Math.min(radius, (right - left) / 2, (bottom - top) / 2)
	);
	const arc = (x: number, y: number) => `A${r} ${r} 0 0 1 ${x} ${y}`;
	return (
		`path(evenodd, "M${-VEIL_EDGE} ${-VEIL_EDGE}H${VEIL_EDGE}V${VEIL_EDGE}H${-VEIL_EDGE}Z` +
		`M${left + r} ${top}H${right - r}${arc(right, top + r)}` +
		`V${bottom - r}${arc(right - r, bottom)}` +
		`H${left + r}${arc(left, bottom - r)}` +
		`V${top + r}${arc(left + r, top)}Z")`
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
			0
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
		window.addEventListener('scroll', update, true);
		window.addEventListener('resize', update);
		const observer =
			typeof ResizeObserver === 'undefined'
				? null
				: new ResizeObserver(update);
		observer?.observe(element);
		return () => {
			window.removeEventListener('scroll', update, true);
			window.removeEventListener('resize', update);
			observer?.disconnect();
		};
	}, [active, element]);
	return hole;
};

/**
 * Decorative scrim; the menu remains responsible for keyboard/focus handling.
 *
 * `spotlightRef` leaves one element uncovered — the card a menu opens beside
 * (Frank, 15.09.2026: the card stays visible next to its menu, and its
 * trigger shows the primary colour while the menu is open). The element
 * cannot simply be lifted above the veil: the list's containers form their
 * own stacking contexts.
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
