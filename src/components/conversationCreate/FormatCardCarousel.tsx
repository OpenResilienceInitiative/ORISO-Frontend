import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	HoverScrollArrows,
	snapTargets
} from '../hoverScrollArrows/HoverScrollArrows';
import { CarouselDots } from '../carouselDots/CarouselDots';

/**
 * Horizontally scrolling row of equally sized format cards.
 *
 * The cards keep a fixed width and height (`.formatCardCarousel__scroller`
 * in `conversationCreate.styles.scss`), so a narrow column scrolls instead of
 * squeezing or stretching them. Navigation is the shared edge control of the
 * waiting rooms (`HoverScrollArrows`, `overlay`): moving the mouse to an edge
 * reveals a round arrow that scrolls one card. Touch screens swipe; the next
 * card peeks in and the page dots underneath show there is more and let
 * anyone jump to a card (Frank, 2026-11-21).
 */

interface FormatCardCarouselProps {
	children: React.ReactNode;
	className?: string;
}

/** Index of the snap target nearest to the current scroll position. */
const nearestIndex = (track: HTMLElement) => {
	const targets = snapTargets(track);
	let best = 0;
	targets.forEach((target, index) => {
		if (
			Math.abs(target - track.scrollLeft) <
			Math.abs(targets[best] - track.scrollLeft)
		) {
			best = index;
		}
	});
	return best;
};

export const FormatCardCarousel = ({
	children,
	className
}: FormatCardCarouselProps) => {
	const { t } = useTranslation();
	const scrollerRef = useRef<HTMLDivElement | null>(null);
	const [count, setCount] = useState(0);
	const [overflows, setOverflows] = useState(false);
	const [activeIndex, setActiveIndex] = useState(0);

	useEffect(() => {
		const track = scrollerRef.current;
		if (!track) return undefined;
		const update = () => {
			setCount(track.children.length);
			setOverflows(track.scrollWidth - track.clientWidth > 1);
			setActiveIndex(nearestIndex(track));
		};
		update();
		const resizeObserver =
			typeof ResizeObserver !== 'undefined'
				? new ResizeObserver(update)
				: undefined;
		resizeObserver?.observe(track);
		// A card can arrive later (availability loads) without a resize.
		const mutationObserver =
			typeof MutationObserver !== 'undefined'
				? new MutationObserver(update)
				: undefined;
		mutationObserver?.observe(track, { childList: true });
		track.addEventListener('scroll', update, { passive: true });
		return () => {
			resizeObserver?.disconnect();
			mutationObserver?.disconnect();
			track.removeEventListener('scroll', update);
		};
	}, []);

	const scrollToCard = useCallback((index: number) => {
		const track = scrollerRef.current;
		if (!track) return;
		const reduce =
			window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ??
			false;
		track.scrollTo({
			left: snapTargets(track)[index] ?? 0,
			behavior: reduce ? 'auto' : 'smooth'
		});
	}, []);

	return (
		<div
			className={`formatCardCarousel${className ? ` ${className}` : ''}`}
			data-cy="format-card-carousel"
		>
			<HoverScrollArrows
				targetRef={scrollerRef}
				labels={{
					previous: t('groupChat.format.cardsPrevious'),
					next: t('groupChat.format.cardsNext')
				}}
				data-cy="format-card-carousel-arrows"
			>
				<div
					ref={scrollerRef}
					className="formatCardCarousel__scroller"
					data-cy="format-card-carousel-track"
				>
					{children}
				</div>
			</HoverScrollArrows>
			{overflows && count > 1 && (
				<CarouselDots
					data-cy="format-card-carousel-dots"
					count={count}
					activeIndex={activeIndex}
					onSelect={scrollToCard}
					getLabel={(index, total) =>
						t('groupChat.format.goToCard', {
							position: index + 1,
							total
						})
					}
				/>
			)}
		</div>
	);
};
