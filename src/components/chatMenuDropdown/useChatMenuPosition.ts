import { useMenuEffects } from '../../features/menu-effects/useMenuEffects';
import { CSSProperties, RefObject, useLayoutEffect, useState } from 'react';

export type ChatMenuPlacement = 'right' | 'left' | 'below' | 'above';

type Rect = Pick<DOMRect, 'left' | 'right' | 'top'>;
type SurfaceRect = Rect & Pick<DOMRect, 'bottom'>;

const MARGIN = 12;
const GAP = 8;

/**
 * Where the menu goes.
 *
 * `anchor` is the trigger — it decides only where the reveal animation grows
 * from. `surface` is what the menu must not cover: the whole card, not the
 * button inside it. Frank, 15.09.2026: "Es soll kein Overlap da sein,
 * sondern ein Nebeneinander. Wer hat gesagt, dass ein Menü immer oben drüber
 * oder unten drunter öffnen muss?"
 *
 * Beside comes first, because that is the arrangement that keeps the card
 * readable while the menu is open. Below and above are the escape routes for
 * when there is genuinely no room beside — on a phone there never is, and
 * then an overlap is unavoidable rather than careless.
 */
export const getChatMenuPosition = (
	anchor: Rect,
	viewport: { width: number; height: number },
	menu: { width: number; height: number },
	/**
	 * Defaults to the trigger itself, which is the behaviour from before.
	 * Written out field by field on purpose: `anchor` is a live `DOMRect` in
	 * the browser, whose properties live on the prototype — `{ ...anchor }`
	 * yields an empty object there and every coordinate becomes `NaN`. Unit
	 * tests pass plain objects and never see it; a Storybook play test does.
	 */
	surface?: SurfaceRect
) => {
	const bounds: SurfaceRect = surface ?? {
		left: anchor.left,
		right: anchor.right,
		top: anchor.top,
		bottom: anchor.top
	};
	const width = Math.min(
		menu.width,
		Math.max(0, viewport.width - MARGIN * 2)
	);
	const maxHeight = Math.max(0, viewport.height - MARGIN * 2);
	const height = Math.min(menu.height, maxHeight);

	const fitsRight = bounds.right + GAP + width <= viewport.width - MARGIN;
	const fitsLeft = bounds.left - GAP - width >= MARGIN;
	const fitsBelow = bounds.bottom + GAP + height <= viewport.height - MARGIN;
	const fitsAbove = bounds.top - GAP - height >= MARGIN;

	const placement: ChatMenuPlacement = fitsRight
		? 'right'
		: fitsLeft
			? 'left'
			: fitsBelow
				? 'below'
				: fitsAbove
					? 'above'
					: 'left';

	const clampLeft = (value: number) =>
		Math.max(MARGIN, Math.min(value, viewport.width - width - MARGIN));
	const clampTop = (value: number) =>
		Math.max(MARGIN, Math.min(value, viewport.height - height - MARGIN));

	const left = clampLeft(
		placement === 'right'
			? bounds.right + GAP
			: placement === 'left'
				? bounds.left - GAP - width
				: // Stacked: hang the menu off the surface's trailing edge.
					bounds.right - width
	);
	const top = clampTop(
		placement === 'below'
			? bounds.bottom + GAP
			: placement === 'above'
				? bounds.top - GAP - height
				: anchor.top
	);

	// The reveal grows out of the trigger, whichever side the menu landed on.
	const transformOrigin =
		placement === 'below'
			? `${Math.max(0, anchor.left - left)}px top`
			: placement === 'above'
				? `${Math.max(0, anchor.left - left)}px bottom`
				: `${placement === 'right' ? 'left' : 'right'} ${Math.max(0, anchor.top - top)}px`;

	return { left, top, width, maxHeight, placement, transformOrigin };
};

/** Measure before paint so the entrance animation starts at its final anchor. */
export const useChatMenuPosition = ({
	open,
	anchorRef,
	menuRef,
	surfaceRef,
	width = 301
}: {
	open: boolean;
	anchorRef: RefObject<HTMLElement | null>;
	menuRef: RefObject<HTMLElement | null>;
	/**
	 * The surface the menu must not cover — the card, not the trigger. Leave
	 * it out and the menu falls back to opening beside the trigger, which is
	 * what it did before and still overlaps whatever the trigger sits in.
	 */
	surfaceRef?: RefObject<HTMLElement | null>;
	width?: number;
}): CSSProperties & { '--chat-menu-placement'?: ChatMenuPlacement } => {
	const { motionEnabled } = useMenuEffects();
	const [position, setPosition] = useState<ReturnType<
		typeof getChatMenuPosition
	> | null>(null);
	useLayoutEffect(() => {
		if (!open) {
			setPosition(null);
			return;
		}
		let frame = 0;
		let attempts = 0;
		let cleanup = () => {};
		const attach = () => {
			const anchor = anchorRef.current;
			const menu = menuRef.current;
			if (!anchor || !menu) {
				// Portals may mount after the parent's layout effect.
				if (attempts++ < 60) frame = requestAnimationFrame(attach);
				return;
			}
			const update = () => {
				const surface = surfaceRef?.current;
				const next = getChatMenuPosition(
					anchor.getBoundingClientRect(),
					{ width: window.innerWidth, height: window.innerHeight },
					{
						width,
						height:
							menu.scrollHeight +
							menu.offsetHeight -
							menu.clientHeight
					},
					surface ? surface.getBoundingClientRect() : undefined
				);
				setPosition((previous) =>
					JSON.stringify(previous) === JSON.stringify(next)
						? previous
						: next
				);
			};
			update();
			const observer =
				typeof ResizeObserver === 'undefined'
					? null
					: new ResizeObserver(update);
			observer?.observe(menu);
			observer?.observe(anchor);
			if (surfaceRef?.current) {
				observer?.observe(surfaceRef.current);
			}
			window.addEventListener('resize', update);
			window.addEventListener('scroll', update, true);
			cleanup = () => {
				observer?.disconnect();
				window.removeEventListener('resize', update);
				window.removeEventListener('scroll', update, true);
			};
		};
		attach();
		return () => {
			cancelAnimationFrame(frame);
			cleanup();
		};
	}, [open, anchorRef, menuRef, surfaceRef, width]);
	const { placement, ...box } = position ?? {};
	return {
		'animation':
			open && position && motionEnabled
				? 'oriso-menu-reveal 160ms ease-out both'
				: 'none',
		'transition': 'none',
		'position': 'fixed',
		'right': 'auto',
		...box,
		'maxWidth': 'calc(100vw - 24px)',
		'overflowY': 'auto',
		'visibility': open && position ? 'visible' : 'hidden',
		// Exposed so the markup can carry `data-placement` and the styles can
		// point a caret or shift a shadow without measuring anything twice.
		'--chat-menu-placement': placement
	};
};
