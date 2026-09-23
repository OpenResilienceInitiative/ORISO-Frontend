import { useMenuEffects } from '../../features/menu-effects/useMenuEffects';
import { CSSProperties, RefObject, useLayoutEffect, useState } from 'react';
import { followLayout } from './followLayout';

export type ChatMenuPlacement = 'right' | 'left' | 'below' | 'above';

type Rect = Pick<DOMRect, 'left' | 'right' | 'top'> & { bottom?: number };
type SurfaceRect = Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom'>;

const MARGIN = 12;
const GAP = 8;

// Chat-room menu spacing: tight beside the trigger, and when stacked below it.
const HUG_BESIDE_GAP = 6;
const HUG_STACK_GAP = 2;
const HUG_STACK_INSET = 4;

type Size = { width: number; height: number };

/**
 * Beside `surface` (the card, not its trigger) first so the card stays readable;
 * below/above only when there is no room beside, as on a phone.
 * Storybook: https://dev.oriso.org/storybook-frontend/?path=/story/components-session-list-sessionlistitem--menu-beside-the-card
 */
export const getChatMenuPosition = (
	anchor: Rect,
	viewport: Size,
	menu: Size,
	/**
	 * Defaults to the trigger. Copied field by field: a live `DOMRect` keeps
	 * its coordinates on the prototype, so spreading it yields `{}`.
	 */
	surface?: SurfaceRect,
	/** Keep close to the trigger (chat-room menu). Needs a surface. */
	options: { hugTrigger?: boolean } = {}
) => {
	const hug = Boolean(options.hugTrigger && surface);
	const besideGap = hug ? HUG_BESIDE_GAP : GAP;
	const stackGap = hug ? HUG_STACK_GAP : GAP;
	const stackInset = hug ? HUG_STACK_INSET : 0;
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

	// With a surface, a stacked menu hangs from the trigger's corner, not
	// from the whole card.
	const stack = surface
		? {
				right: anchor.right,
				top: anchor.top,
				bottom: anchor.bottom ?? anchor.top
			}
		: bounds;
	// Hugging may cover the card's empty trailing strip on the right.
	const rightEdge = hug ? anchor.right : bounds.right;

	const candidates: Record<
		ChatMenuPlacement,
		{ fits: boolean; left: number; top: number }
	> = {
		right: {
			fits: rightEdge + besideGap + width <= viewport.width - MARGIN,
			left: rightEdge + besideGap,
			top: anchor.top
		},
		left: {
			fits: bounds.left - besideGap - width >= MARGIN,
			left: bounds.left - besideGap - width,
			top: anchor.top
		},
		below: {
			fits: stack.bottom + stackGap + height <= viewport.height - MARGIN,
			left: stack.right - stackInset - width,
			top: stack.bottom + stackGap
		},
		above: {
			fits: stack.top - stackGap - height >= MARGIN,
			left: stack.right - stackInset - width,
			top: stack.top - stackGap - height
		}
	};
	const order: ChatMenuPlacement[] = ['right', 'left', 'below', 'above'];
	const placement = order.find((side) => candidates[side].fits) ?? 'left';

	const left = Math.max(
		MARGIN,
		Math.min(candidates[placement].left, viewport.width - width - MARGIN)
	);
	const top = Math.max(
		MARGIN,
		Math.min(candidates[placement].top, viewport.height - height - MARGIN)
	);

	// The reveal grows out of the trigger, whichever side the menu landed on.
	const stackedOrigin = surface
		? 'right'
		: `${Math.max(0, anchor.left - left)}px`;
	const besideTop = `${Math.max(0, anchor.top - top)}px`;
	const transformOrigin = {
		right: `left ${besideTop}`,
		left: `right ${besideTop}`,
		below: `${stackedOrigin} top`,
		above: `${stackedOrigin} bottom`
	}[placement];

	return { left, top, width, maxHeight, placement, transformOrigin };
};

/** Measure before paint so the entrance animation starts at its final anchor. */
export const useChatMenuPosition = ({
	open,
	anchorRef,
	menuRef,
	surfaceRef,
	width = 301,
	hugTrigger = false
}: {
	open: boolean;
	anchorRef: RefObject<HTMLElement | null>;
	menuRef: RefObject<HTMLElement | null>;
	/** What the menu must not cover; without it the menu opens beside the trigger. */
	surfaceRef?: RefObject<HTMLElement | null>;
	width?: number;
	/** See `getChatMenuPosition` — the chat-room menu's tight spacing. */
	hugTrigger?: boolean;
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
					surface ? surface.getBoundingClientRect() : undefined,
					{ hugTrigger }
				);
				setPosition((previous) =>
					JSON.stringify(previous) === JSON.stringify(next)
						? previous
						: next
				);
			};
			update();
			cleanup = followLayout(update, [menu, anchor, surfaceRef?.current]);
		};
		attach();
		return () => {
			cancelAnimationFrame(frame);
			cleanup();
		};
	}, [open, anchorRef, menuRef, surfaceRef, width, hugTrigger]);
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
		// Lets the markup carry `data-placement` without measuring twice.
		'--chat-menu-placement': placement
	};
};
