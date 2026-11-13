import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { registrationMd3 } from '../../registration/registrationDesign/registrationDesign';
import { CarouselDots } from '../../carouselDots/CarouselDots';
import {
	artworkFit,
	processArtwork,
	RegistrationArtworkEntry
} from '../../../resources/img/registration-md3/registrationArtwork';

export interface HandoverStep {
	key: string;
	artwork: RegistrationArtworkEntry;
	/** i18n keys; default to the registration's `registration.handover.steps.<key>`. */
	titleKey?: string;
	textKey?: string;
	titleFallback?: string;
	textFallback?: string;
	/**
	 * What the picture shows, for someone who cannot see it. The registration's
	 * own motifs repeat the card's text and stay decorative (`alt=""`); a card
	 * whose picture carries meaning of its own hands in a description (Frank
	 * delivered them with the self-help motifs, 2026-09-07).
	 */
	altFallback?: string;
	altKey?: string;
}

const STEPS: HandoverStep[] = [
	{
		key: 'write',
		artwork: processArtwork.write
	},
	{
		key: 'counsellor',
		artwork: processArtwork.counsellor
	},
	{
		key: 'reply',
		artwork: processArtwork.reply
	}
];

export interface HandoverCarouselProps {
	/** Called once every card image has settled (loaded or failed). */
	onArtworkSettled?: () => void;
	/**
	 * The three cards. Default: the registration's. The live-chat entry room
	 * hands in its own — the same cards, other words and pictures — so the
	 * handover screen is one module for every way in (Frank, 2026-09-05:
	 * "unser Entry Room, den wir ja so eigentlich als Standardmodul haben").
	 */
	steps?: HandoverStep[];
}

/**
 * One card size for every waiting room — the live-chat waiting room's, which
 * the design was judged on. A room used to pass its own width, so each new one
 * had to be told to match (Frank, 2026-10-15: "das kann nicht eine
 * Designentscheidung sein, das muss ich zehnmal testen").
 */
const CARD_WIDTH = { xs: 300, sm: 372 };
const SCROLL_IDLE_MS = 120;
const MAX_DOT_SCROLL_MS = 800;
/**
 * How far the mouse must travel before a press on the track becomes a drag.
 * Below it the press is a click: it neither moves the track nor changes the
 * chosen card, so clicking a card keeps the step picked with the dots.
 */
const DRAG_START_PX = 4;

/**
 * Left edge of every card in the track's own scroll coordinates.
 *
 * Not `offsetLeft`: that counts from the nearest *positioned* ancestor, and
 * the track is not one. On desktop that ancestor is the page column, 600 px
 * and more to the left, so every card looked far right of where it was — the
 * dot never left the first card and every dot jumped to the end (#2139).
 */
const cardLefts = (track: HTMLElement) => {
	const origin = track.getBoundingClientRect().left - track.scrollLeft;
	return (Array.from(track.children) as HTMLElement[]).map(
		(card) => card.getBoundingClientRect().left - origin
	);
};

/**
 * The scrollLeft that centres card `index`, clamped to what the track can
 * actually scroll to. Where two cards fit at once the first and the last card
 * clamp to the track's ends, so comparing against these targets (not against
 * card centres) keeps a released drag at the end it was left at.
 */
const cardTargets = (track: HTMLElement) => {
	const max = Math.max(0, track.scrollWidth - track.clientWidth);
	const cards = Array.from(track.children) as HTMLElement[];
	return cardLefts(track).map((left, index) =>
		Math.min(
			max,
			Math.max(
				0,
				left - (track.clientWidth - cards[index].offsetWidth) / 2
			)
		)
	);
};

/**
 * "So geht es weiter" — three cards the user swipes through while the app
 * finishes loading behind the gate button.
 *
 * Only the first motif is fetched eagerly; the other two are lazy. Every image
 * box reserves its aspect ratio up front, so a slow image never shifts the text
 * the user is already reading.
 */
export const HandoverCarousel = ({
	onArtworkSettled,
	steps = STEPS
}: HandoverCarouselProps) => {
	const { t } = useTranslation();
	const trackRef = useRef<HTMLDivElement>(null);
	const [activeIndex, setActiveIndex] = useState(0);
	const selectDotRef = useRef<((index: number) => void) | null>(null);
	const settledCount = useRef(0);

	const noteSettled = useCallback(() => {
		settledCount.current += 1;
		if (settledCount.current >= steps.length) {
			onArtworkSettled?.();
		}
	}, [onArtworkSettled, steps.length]);

	useEffect(() => {
		const track = trackRef.current;
		if (!track) {
			return undefined;
		}

		const updateFromScrollPosition = () => {
			// Read the real card positions rather than an averaged card
			// width: where several cards fit at once, the browser clamps
			// scrollLeft well before the averaged target for the last card,
			// and the dot then reported a step the user was not on.
			const lefts = cardLefts(track);
			if (!lefts.length) {
				return;
			}
			const cards = Array.from(track.children) as HTMLElement[];
			const centre = track.scrollLeft + track.clientWidth / 2;
			let nearest = 0;
			let best = Infinity;
			lefts.forEach((left, index) => {
				const cardCentre = left + cards[index].offsetWidth / 2;
				const distance = Math.abs(cardCentre - centre);
				if (distance < best) {
					best = distance;
					nearest = index;
				}
			});
			// At either end the clamp decides, not the centre: the first and
			// the last card are fully in view there (several fit at once on
			// desktop, so the centre never reaches them).
			const max = track.scrollWidth - track.clientWidth;
			if (max > 0 && track.scrollLeft >= max - 1) {
				nearest = cards.length - 1;
			} else if (track.scrollLeft <= 1) {
				nearest = 0;
			}
			setActiveIndex(nearest);
		};

		let selectedByDot: number | null = null;
		let settleTimer: number | undefined;
		let settleDeadline = 0;

		const selectedCardIsVisible = () => {
			const card =
				selectedByDot === null ? null : track.children[selectedByDot];
			if (!card) return false;
			const trackLeft = track.getBoundingClientRect().left;
			const bounds = card.getBoundingClientRect();
			const centre = bounds.left + bounds.width / 2;
			return (
				centre >= trackLeft && centre <= trackLeft + track.clientWidth
			);
		};

		const clearSettleTimer = () => {
			window.clearTimeout(settleTimer);
			settleTimer = undefined;
		};

		const followScrollPosition = () => {
			selectedByDot = null;
			updateFromScrollPosition();
		};

		const settleDotScroll = () => {
			if (settleTimer === undefined) return;
			clearSettleTimer();
			if (!selectedCardIsVisible()) followScrollPosition();
		};

		const scheduleSettle = () => {
			clearSettleTimer();
			const remaining = Math.max(0, settleDeadline - performance.now());
			settleTimer = window.setTimeout(
				settleDotScroll,
				Math.min(SCROLL_IDLE_MS, remaining)
			);
		};

		const beginSettlement = () => {
			settleDeadline = performance.now() + MAX_DOT_SCROLL_MS;
			scheduleSettle();
		};

		let trackWidth = track.clientWidth;
		const reconcileTrackWidth = () => {
			const width = track.clientWidth;
			if (width === trackWidth) return false;
			trackWidth = width;
			if (selectedCardIsVisible()) {
				beginSettlement();
			} else {
				clearSettleTimer();
				followScrollPosition();
			}
			return true;
		};

		const onScroll = () => {
			// A resize can re-snap before or after the observer callback.
			if (reconcileTrackWidth()) return;
			// Protect explicit selection only while its movement is settling.
			// The next independent scroll follows geometry regardless of input.
			if (settleTimer !== undefined) {
				scheduleSettle();
				return;
			}
			followScrollPosition();
		};

		selectDotRef.current = (index) => {
			const card = track.children[index] as HTMLElement | undefined;
			if (!card) return;
			selectedByDot = index;
			setActiveIndex(index);
			const reducedMotion = window.matchMedia?.(
				'(prefers-reduced-motion: reduce)'
			).matches;
			const previousLeft = track.scrollLeft;
			// Centre the card the dot stands for; the first and the last
			// card clamp to the track's ends (#2139: not `offsetLeft`).
			const target = cardTargets(track)[index];
			beginSettlement();
			track.scrollTo({
				left: target,
				behavior: reducedMotion ? 'auto' : 'smooth'
			});
			// An unchanged position does not generate a scrollend event.
			if (
				target === previousLeft ||
				(reducedMotion && track.scrollLeft === previousLeft)
			) {
				settleDotScroll();
			}
		};

		const resizeObserver =
			typeof ResizeObserver !== 'undefined'
				? new ResizeObserver(reconcileTrackWidth)
				: undefined;
		resizeObserver?.observe(track);
		track.addEventListener('scroll', onScroll, { passive: true });
		track.addEventListener('scrollend', settleDotScroll);
		return () => {
			selectDotRef.current = null;
			clearSettleTimer();
			resizeObserver?.disconnect();
			track.removeEventListener('scroll', onScroll);
			track.removeEventListener('scrollend', settleDotScroll);
		};
	}, []);

	/** Scroll to card `index` and hold its dot while the scroll settles. */
	const scrollToCard = (index: number) => selectDotRef.current?.(index);

	/*
	 * A mouse cannot swipe: without a trackpad the cards could not be moved at
	 * all, and the scrollbar is hidden. Dragging with the mouse scrolls the
	 * track like a finger would; on release the nearest card snaps in.
	 * Touch and pen keep the browser's own scrolling.
	 */
	const drag = useRef<{
		x: number;
		left: number;
		pointerId: number;
		started: boolean;
	} | null>(null);
	const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
		const track = trackRef.current;
		if (
			!track ||
			event.pointerType !== 'mouse' ||
			event.button !== 0 ||
			track.scrollWidth <= track.clientWidth
		) {
			return;
		}
		// Only remember the press. Snap stays on and the pointer is not
		// captured until the mouse actually moves (DRAG_START_PX).
		drag.current = {
			x: event.clientX,
			left: track.scrollLeft,
			pointerId: event.pointerId,
			started: false
		};
	};
	const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
		const track = trackRef.current;
		const current = drag.current;
		if (!track || !current) {
			return;
		}
		if (!current.started && (event.buttons & 1) === 0) {
			// Released outside the track before it became a drag: the
			// track never saw the pointerup, so drop the press here.
			drag.current = null;
			return;
		}
		const distance = event.clientX - current.x;
		if (!current.started) {
			if (Math.abs(distance) < DRAG_START_PX) {
				return;
			}
			current.started = true;
			track.setPointerCapture?.(current.pointerId);
			track.dataset.dragging = 'true';
		}
		track.scrollLeft = current.left - distance;
	};
	const endDrag = (event: React.PointerEvent<HTMLElement>) => {
		const track = trackRef.current;
		const current = drag.current;
		if (!track || !current) {
			return;
		}
		drag.current = null;
		// A press that never moved is a click: leave the track and the
		// chosen card exactly as they are.
		if (!current.started) {
			return;
		}
		track.releasePointerCapture?.(event.pointerId);
		delete track.dataset.dragging;
		// Snap is off while dragging; hand the position back to it. The
		// nearest card is the one whose (clamped) scroll target is closest,
		// so a drag released at either end stays there.
		const targets = cardTargets(track);
		let nearest = 0;
		targets.forEach((target, index) => {
			if (
				Math.abs(target - track.scrollLeft) <
				Math.abs(targets[nearest] - track.scrollLeft)
			) {
				nearest = index;
			}
		});
		scrollToCard(nearest);
	};

	return (
		<Box
			sx={{
				// Mobile fills the screen; on desktop the block hugs its cards
				// so the dots stay attached to them instead of drifting to the
				// bottom of a tall window.
				flex: { xs: 1, sm: 'none' },
				minHeight: 0,
				display: 'flex',
				flexDirection: 'column'
			}}
		>
			<Box
				ref={trackRef}
				component="ul"
				data-cy="handover-carousel"
				onPointerDown={onPointerDown}
				onPointerMove={onPointerMove}
				onPointerUp={endDrag}
				onPointerCancel={endDrag}
				onDragStart={(event: React.DragEvent) => event.preventDefault()}
				sx={{
					'flex': 1,
					'minHeight': 0,
					'display': 'flex',
					// Mobile: cards fill the available height, the motif grows
					// with them (design 8c). Desktop: cards are content-height
					// with a square motif (8d), so a tall window does not leave
					// a dead white area under each card's text.
					'alignItems': { xs: 'stretch', sm: 'flex-start' },
					'gap': { xs: 1.5, sm: 2.5 },
					'm': 0,
					'p': 0,
					'listStyle': 'none',
					'overflowX': 'auto',
					'overflowY': 'hidden',
					'scrollSnapType': 'x mandatory',
					'scrollbarWidth': 'none',
					'&::-webkit-scrollbar': { display: 'none' },
					'@media (hover: hover) and (pointer: fine)': {
						cursor: 'grab'
					},
					'&[data-dragging]': {
						cursor: 'grabbing',
						scrollSnapType: 'none',
						userSelect: 'none'
					}
				}}
			>
				{steps.map((step, index) => (
					<Box
						key={step.key}
						component="li"
						data-cy={`handover-card-${step.key}`}
						sx={{
							flex: 'none',
							width: CARD_WIDTH,
							// Centre on every width: the dots and a released
							// drag centre their card (`cardTargets`), and a
							// start snap would pull the middle card off to an
							// end where two cards fit at once.
							scrollSnapAlign: 'center',
							display: 'flex',
							flexDirection: 'column',
							bgcolor: registrationMd3.surface,
							border: `1px solid ${registrationMd3.outlineVariant}`,
							borderRadius: { xs: '18px', sm: '20px' },
							overflow: 'hidden'
						}}
					>
						<Box
							sx={{
								position: 'relative',
								// Either way the box has a definite size before
								// the image arrives, so a late motif never
								// shifts the text the user is already reading.
								flex: { xs: 1, sm: 'none' },
								minHeight: { xs: 170, sm: 0 },
								aspectRatio: { xs: 'auto', sm: '1 / 1' },
								bgcolor: registrationMd3.surfaceContainer
							}}
						>
							<Box
								component="img"
								src={step.artwork.src}
								alt={
									step.altKey || step.altFallback
										? t(
												step.altKey ??
													`registration.handover.steps.${step.key}.alt`,
												step.altFallback ?? ''
											)
										: ''
								}
								// Card 1 is what everyone sees; 2 and 3 are one
								// swipe away and can wait for spare bandwidth.
								loading={index === 0 ? 'eager' : 'lazy'}
								fetchPriority={index === 0 ? 'high' : 'low'}
								decoding="async"
								onLoad={noteSettled}
								onError={noteSettled}
								sx={{
									width: '100%',
									height: '100%',
									objectFit: artworkFit(step.artwork),
									p: step.artwork.pending ? 5 : 0,
									opacity: step.artwork.pending ? 0.45 : 1,
									display: 'block'
								}}
							/>
							<Box
								component="span"
								aria-hidden
								sx={{
									position: 'absolute',
									left: { xs: 12, sm: 14 },
									top: { xs: 12, sm: 14 },
									width: { xs: 34, sm: 36 },
									height: { xs: 34, sm: 36 },
									borderRadius: '50%',
									bgcolor: registrationMd3.primary,
									color: registrationMd3.onPrimary,
									fontSize: { xs: 16, sm: 17 },
									fontWeight: 700,
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center'
								}}
							>
								{index + 1}
							</Box>
						</Box>
						<Box
							sx={{
								flex: 'none',
								px: { xs: 2, sm: 2.5 },
								pt: { xs: 1.75, sm: 2 },
								pb: { xs: 2, sm: 2.5 }
							}}
						>
							<Typography
								component="h2"
								sx={{
									fontSize: { xs: 17, sm: 18 },
									fontWeight: 700,
									lineHeight: { xs: '23px', sm: '24px' },
									// Two title lines are reserved so every
									// card is the same height regardless of
									// how its headline wraps.
									minHeight: { xs: '46px', sm: '48px' },
									mb: 0.75,
									color: registrationMd3.onSurface
								}}
							>
								{t(
									step.titleKey ??
										`registration.handover.steps.${step.key}.title`
								)}
							</Typography>
							<Typography
								sx={{
									fontSize: { xs: 13, sm: 14 },
									lineHeight: { xs: '19px', sm: '20px' },
									color: registrationMd3.onSurfaceVariant,
									// Design rule: at most three lines after
									// the heading, and always the same box —
									// shorter copy pads, longer copy clips.
									minHeight: { xs: '57px', sm: '60px' },
									display: '-webkit-box',
									WebkitLineClamp: 3,
									WebkitBoxOrient: 'vertical',
									overflow: 'hidden'
								}}
							>
								{t(
									step.textKey ??
										`registration.handover.steps.${step.key}.text`
								)}
							</Typography>
						</Box>
					</Box>
				))}
			</Box>

			<CarouselDots
				data-cy="handover-carousel-dots"
				count={steps.length}
				activeIndex={activeIndex}
				onSelect={scrollToCard}
				getLabel={(index, total) =>
					t('registration.handover.goToStep', {
						position: index + 1,
						total
					})
				}
				// The 24 px targets add 9 px above the mark: same gap as before.
				sx={{ flex: 'none', pt: { xs: 0.375, sm: 0.875 } }}
			/>
		</Box>
	);
};
