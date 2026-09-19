import { useMenuEffects } from '../../features/menu-effects/useMenuEffects';
import { CSSProperties, RefObject, useLayoutEffect, useState } from 'react';

export type ChatMenuPlacement = 'right' | 'left' | 'below' | 'above';

type Rect = Pick<DOMRect, 'left' | 'right' | 'top'> & { bottom?: number };
type SurfaceRect = Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom'>;

const MARGIN = 12;
const GAP = 8;

/*
 * The chat-room menu's own spacing, measured by Frank on 17.09.2026: at most
 * 6 px between the ⋮ trigger and a menu beside it ("max 6px"), and on a
 * phone 2 px below the trigger with the right edge pulled 4 px in.
 */
const HUG_BESIDE_GAP = 6;
const HUG_STACK_GAP = 2;
const HUG_STACK_INSET = 4;

/**
 * Where the menu goes.
 *
 * `anchor` is the trigger — it decides only where the reveal animation grows
 * from. `surface` is what the menu must not cover: the whole card, not the
 * button inside it. Frank, 15.09.2026: "Es soll kein Overlap da sein,
 * sondern ein Nebeneinander. Wer hat gesagt, dass ein Menü immer oben drüber
 * oder unten drunter öffnen muss?"
 *
 * Seen in Storybook:
 * https://dev.oriso.org/storybook-frontend/?path=/story/components-session-list-sessionlistitem--menu-beside-the-card
 * https://dev.oriso.org/storybook-frontend/?path=/story/organisms-casehandover-casehandoveractionbutton--menu-beside-the-card
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
	surface?: SurfaceRect,
	/**
	 * `hugTrigger`: the menu keeps close to its trigger — beside it at
	 * `HUG_BESIDE_GAP` (covering the card's empty trailing strip if the
	 * trigger sits there), stacked at `HUG_STACK_GAP` with its right edge
	 * `HUG_STACK_INSET` inside the trigger's. Needs a surface.
	 */
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

	/*
	 * Where a stacked menu hangs from. Without a surface that is the old
	 * behaviour. With one, a menu that cannot sit beside the card hangs from
	 * the trigger's corner — Frank, 17.09.2026, on the phone: below the
	 * whole card it was "mit dem riesen Abstand" from its button; "das muss
	 * natürlich dann rechts im Corner sein".
	 */
	const stack = surface
		? {
				right: anchor.right,
				top: anchor.top,
				bottom: anchor.bottom ?? anchor.top
			}
		: bounds;

	// Beside on the right starts from the trigger when hugging it, from the
	// card otherwise; on the left the card is in the way either way.
	const rightEdge = hug ? anchor.right : bounds.right;

	const fitsRight = rightEdge + besideGap + width <= viewport.width - MARGIN;
	const fitsLeft = bounds.left - besideGap - width >= MARGIN;
	const fitsBelow =
		stack.bottom + stackGap + height <= viewport.height - MARGIN;
	const fitsAbove = stack.top - stackGap - height >= MARGIN;

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
			? rightEdge + besideGap
			: placement === 'left'
				? bounds.left - besideGap - width
				: // Stacked: right edge at the trigger's (inset when hugging).
					stack.right - stackInset - width
	);
	const top = clampTop(
		placement === 'below'
			? stack.bottom + stackGap
			: placement === 'above'
				? stack.top - stackGap - height
				: anchor.top
	);

	// The reveal grows out of the trigger, whichever side the menu landed on.
	const stackedOrigin = surface
		? 'right'
		: `${Math.max(0, anchor.left - left)}px`;
	const transformOrigin =
		placement === 'below'
			? `${stackedOrigin} top`
			: placement === 'above'
				? `${stackedOrigin} bottom`
				: `${placement === 'right' ? 'left' : 'right'} ${Math.max(0, anchor.top - top)}px`;

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
	/**
	 * The surface the menu must not cover — the card, not the trigger. Leave
	 * it out and the menu falls back to opening beside the trigger, which is
	 * what it did before and still overlaps whatever the trigger sits in.
	 */
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
			// Transforms move the trigger without resizing anything: a menu
			// opened while its row still scales in (the list's entrance)
			// was left behind. Re-measure whenever an animation ends.
			window.addEventListener('animationend', update, true);
			cleanup = () => {
				observer?.disconnect();
				window.removeEventListener('resize', update);
				window.removeEventListener('scroll', update, true);
				window.removeEventListener('animationend', update, true);
			};
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
		// Exposed so the markup can carry `data-placement` and the styles can
		// point a caret or shift a shadow without measuring anything twice.
		'--chat-menu-placement': placement
	};
};
