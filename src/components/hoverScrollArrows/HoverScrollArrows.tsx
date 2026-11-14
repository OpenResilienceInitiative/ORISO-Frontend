import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, ButtonBase, SxProps, Theme } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useTranslation } from 'react-i18next';
import { orisoInputColors } from '../form/orisoInputDesign';

/** -1 = towards the start (left), 1 = towards the end (right). */
export type ScrollDirection = -1 | 1;

export interface HoverScrollArrowsProps {
	/** The horizontally scrolling element the arrows move. */
	'targetRef': React.RefObject<HTMLElement | null>;
	/** The scroll container itself, rendered inside the wrapper. */
	'children': React.ReactNode;
	/**
	 * Move one step. Default: scroll to the next (or previous) snap
	 * position of the container's children. An owner that tracks its own
	 * position (e.g. carousel dots) hands in its own step so both agree.
	 */
	'onStep'?: (direction: ScrollDirection) => void;
	/**
	 * The scrollLeft positions one step can land on. Default: `snapTargets`.
	 * An owner with its own `onStep` hands in the targets that step uses, so
	 * an arrow exists exactly when its step can move.
	 */
	'targets'?: (track: HTMLElement) => number[];
	/**
	 * Minimum distance from an edge, in px, at which the pointer reveals that
	 * edge's arrow. The zone grows to a third of a card, and to all of a card
	 * the edge cuts off (see `edgeZoneWidth`).
	 */
	'edgeZone'?: number;
	'data-cy'?: string;
	'sx'?: SxProps<Theme>;
}

/** Treat sub-pixel leftovers at either end as "at the end". */
const EDGE_TOLERANCE = 1;
const STRIP_WIDTH = 72;
const BUTTON_SIZE = 40;
const FADE = '180ms cubic-bezier(0.2, 0, 0, 1)';
/** The arrow pops in softly: a short ease-out with a little overshoot. */
const POP = '320ms cubic-bezier(0.34, 1.24, 0.44, 1)';

const clamp = (value: number, max: number) => Math.min(max, Math.max(0, value));

/**
 * The scrollLeft at which each child of `track` snaps in, honouring the
 * child's own `scroll-snap-align` (start, center or end), the track's
 * `scroll-padding` (the snap edge sits that far inside the track), and
 * clamped to what the track can actually scroll to.
 */
export const snapTargets = (track: HTMLElement) => {
	const max = Math.max(0, track.scrollWidth - track.clientWidth);
	const origin = track.getBoundingClientRect().left - track.scrollLeft;
	const trackStyle = window.getComputedStyle(track);
	const padStart = parseFloat(trackStyle.scrollPaddingLeft) || 0;
	const padEnd = parseFloat(trackStyle.scrollPaddingRight) || 0;
	const snapport = track.clientWidth - padStart - padEnd;
	return (Array.from(track.children) as HTMLElement[]).map((child) => {
		const bounds = child.getBoundingClientRect();
		const left = bounds.left - origin;
		const width = child.offsetWidth || bounds.width || 0;
		// `scroll-snap-align` is "<block> <inline>" or one value for both.
		const align =
			window.getComputedStyle(child).scrollSnapAlign?.split(' ').pop() ??
			'start';
		if (align === 'center') {
			return clamp(left - padStart - (snapport - width) / 2, max);
		}
		if (align === 'end') {
			return clamp(left + width + padEnd - track.clientWidth, max);
		}
		return clamp(left - padStart, max);
	});
};

/**
 * Index of the snap target one step from `scrollLeft` in `direction`, or
 * `null` when there is none (already at that end).
 */
export const stepTargetIndex = (
	targets: number[],
	scrollLeft: number,
	direction: ScrollDirection
): number | null => {
	if (direction === 1) {
		const index = targets.findIndex(
			(target) => target > scrollLeft + EDGE_TOLERANCE
		);
		return index === -1 ? null : index;
	}
	for (let index = targets.length - 1; index >= 0; index -= 1) {
		if (targets[index] < scrollLeft - EDGE_TOLERANCE) return index;
	}
	return null;
};

const prefersReducedMotion = () =>
	window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** Default step: scroll the container to its next snap position. */
export const scrollOneStep = (
	track: HTMLElement,
	direction: ScrollDirection
) => {
	const targets = snapTargets(track);
	const index = stepTargetIndex(targets, track.scrollLeft, direction);
	if (index === null) return;
	track.scrollTo({
		left: targets[index],
		behavior: prefersReducedMotion() ? 'auto' : 'smooth'
	});
};

type Side = 'start' | 'end';

/**
 * How far into the track the pointer reveals one edge's arrow: the outer
 * third of the card standing at that edge (Frank, 2026-11-11: "so ein
 * Drittel der Card am Rand"), or all of it where the edge cuts it off.
 * Never less than `minimum`, never more than half the track.
 */
export const edgeZoneWidth = (
	track: HTMLElement | null,
	wrapper: DOMRect,
	side: Side,
	minimum: number
) => {
	const visible = (track ? (Array.from(track.children) as HTMLElement[]) : [])
		.map((card) => card.getBoundingClientRect())
		.filter(
			(card) =>
				card.width > 0 &&
				card.left < wrapper.right - EDGE_TOLERANCE &&
				card.right > wrapper.left + EDGE_TOLERANCE
		);
	let zone = minimum;
	if (visible.length) {
		if (side === 'start') {
			const card = visible[0];
			zone =
				card.left < wrapper.left - EDGE_TOLERANCE
					? card.right - wrapper.left
					: card.left + card.width / 3 - wrapper.left;
		} else {
			const card = visible[visible.length - 1];
			zone =
				card.right > wrapper.right + EDGE_TOLERANCE
					? wrapper.right - card.left
					: wrapper.right - (card.right - card.width / 3);
		}
	}
	return Math.min(Math.max(zone, minimum), wrapper.width / 2);
};

/**
 * Desktop arrows for anything that scrolls sideways (a carousel, a gallery).
 *
 * A mouse without a trackpad cannot scroll sideways, and dragging is not
 * something people try. Hovering near an edge fades in a translucent strip
 * with a small round arrow button; a click moves one card. The left arrow
 * only exists once there is something to go back to, the right one only
 * while there is more to see (Frank, 2026-11-11).
 *
 * Only for a fine pointer that can hover: phones and tablets swipe and never
 * see the arrows. Keyboard focus on an arrow shows it too.
 */
export const HoverScrollArrows = ({
	targetRef,
	children,
	onStep,
	targets = snapTargets,
	edgeZone = 120,
	'data-cy': dataCy = 'hover-scroll-arrows',
	sx
}: HoverScrollArrowsProps) => {
	const { t } = useTranslation();
	const [canPrev, setCanPrev] = useState(false);
	const [canNext, setCanNext] = useState(false);
	const [near, setNear] = useState<Side | null>(null);
	const wrapperRef = useRef<HTMLDivElement>(null);
	const previousRef = useRef<HTMLButtonElement>(null);
	const nextRef = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		const track = targetRef.current;
		if (!track) return undefined;
		const update = () => {
			// An arrow exists only while its step has somewhere to go, so it
			// never sits there doing nothing (e.g. a centred card wider than
			// the track overflows without a further target).
			const positions = targets(track);
			const prev =
				stepTargetIndex(positions, track.scrollLeft, -1) !== null;
			const next =
				stepTargetIndex(positions, track.scrollLeft, 1) !== null;
			// The arrow about to disappear may hold keyboard focus (the step
			// that reached the end). Hand focus on before it unmounts, so a
			// keyboard user keeps their place.
			const active = track.ownerDocument.activeElement;
			const losing =
				(!prev && active === previousRef.current) ||
				(!next && active === nextRef.current);
			if (losing) {
				const other =
					active === previousRef.current
						? next && nextRef.current
						: prev && previousRef.current;
				(other || wrapperRef.current)?.focus({ preventScroll: true });
			}
			setCanPrev(prev);
			setCanNext(next);
		};
		update();
		const resizeObserver =
			typeof ResizeObserver !== 'undefined'
				? new ResizeObserver(update)
				: undefined;
		resizeObserver?.observe(track);
		track.addEventListener('scroll', update, { passive: true });
		return () => {
			resizeObserver?.disconnect();
			track.removeEventListener('scroll', update);
		};
	}, [targetRef, targets]);

	// Pointer position rather than `:hover` on the strips: the strips let
	// the pointer through, so cards under them stay draggable and clickable.
	const onPointerMove = useCallback(
		(event: React.PointerEvent<HTMLElement>) => {
			if (event.pointerType === 'touch') return;
			const bounds = event.currentTarget.getBoundingClientRect();
			const x = event.clientX - bounds.left;
			const track = targetRef.current;
			setNear(
				x <= edgeZoneWidth(track, bounds, 'start', edgeZone)
					? 'start'
					: x >=
						  bounds.width -
								edgeZoneWidth(track, bounds, 'end', edgeZone)
						? 'end'
						: null
			);
		},
		[edgeZone, targetRef]
	);

	const step = (direction: ScrollDirection) => {
		if (onStep) {
			onStep(direction);
			return;
		}
		const track = targetRef.current;
		if (track) scrollOneStep(track, direction);
	};

	const renderSide = (side: Side) => {
		const isStart = side === 'start';
		if (isStart ? !canPrev : !canNext) return null;
		const Icon = isStart ? ChevronLeftIcon : ChevronRightIcon;
		return (
			<Box
				key={side}
				data-cy={`${dataCy}-${side}`}
				data-near={near === side || undefined}
				sx={{
					'display': 'none',
					'@media (hover: hover) and (pointer: fine)': {
						display: 'flex'
					},
					'position': 'absolute',
					'top': 0,
					'bottom': 0,
					[isStart ? 'left' : 'right']: 0,
					'width': STRIP_WIDTH,
					'alignItems': 'center',
					'justifyContent': 'center',
					'pointerEvents': 'none',
					'zIndex': 1,
					'opacity': 0,
					'transition': `opacity ${POP}`,
					'&[data-near], &:has(.Mui-focusVisible)': { opacity: 1 },
					// The button grows in from slightly smaller and slightly
					// outside, then settles.
					'& button': {
						transform: `translateX(${isStart ? -8 : 8}px) scale(0.8)`
					},
					'@media (prefers-reduced-motion: reduce)': {
						'& button, &[data-near] button, &:has(.Mui-focusVisible) button':
							{ transform: 'none' }
					},
					// Hidden arrows let the pointer through, so a drag that
					// starts at the edge still moves the cards.
					'&[data-near] button, &:has(.Mui-focusVisible) button': {
						pointerEvents: 'auto',
						transform: 'none'
					},
					// The translucent strip: the surface colour fading out
					// towards the cards, so the arrow reads on any motif.
					'&::before': {
						content: '""',
						position: 'absolute',
						inset: 0,
						opacity: 0.85,
						background: `linear-gradient(to ${
							isStart ? 'right' : 'left'
						}, ${orisoInputColors.surface}, transparent)`
					}
				}}
			>
				<ButtonBase
					ref={isStart ? previousRef : nextRef}
					aria-label={t(
						isStart ? 'app.scrollPrevious' : 'app.scrollNext'
					)}
					data-cy={`${dataCy}-${isStart ? 'previous' : 'next'}`}
					onClick={() => step(isStart ? -1 : 1)}
					sx={{
						'position': 'relative',
						'pointerEvents': 'none',
						'width': BUTTON_SIZE,
						'height': BUTTON_SIZE,
						'borderRadius': '50%',
						'bgcolor': orisoInputColors.surface,
						'color': orisoInputColors.primary,
						'border': `1px solid ${orisoInputColors.outline}`,
						'opacity': 0.8,
						'transition': `opacity ${FADE}, background-color ${FADE}, transform ${POP}`,
						'&:hover': {
							opacity: 1,
							bgcolor: orisoInputColors.surfaceContainerHigh
						},
						'&.Mui-focusVisible': {
							opacity: 1,
							outline: `2px solid ${orisoInputColors.focus}`,
							outlineOffset: 2
						}
					}}
				>
					<Icon fontSize="small" />
				</ButtonBase>
			</Box>
		);
	};

	return (
		<Box
			ref={wrapperRef}
			// Focus lands here only when the last arrow it was on goes away.
			tabIndex={-1}
			data-cy={dataCy}
			onPointerMove={onPointerMove}
			onPointerLeave={() => setNear(null)}
			sx={[
				{
					// A column, so the wrapped track lays out exactly as it
					// did without the wrapper (its `flex` stays vertical).
					position: 'relative',
					display: 'flex',
					flexDirection: 'column',
					minWidth: 0,
					outline: 'none'
				},
				...(Array.isArray(sx) ? sx : [sx])
			]}
		>
			{children}
			{renderSide('start')}
			{renderSide('end')}
		</Box>
	);
};
