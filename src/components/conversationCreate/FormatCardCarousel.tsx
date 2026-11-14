import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ArrowLeftIcon } from '../../resources/img/icons/arrow-left.svg';
import { ReactComponent as ArrowRightIcon } from '../../resources/img/icons/arrow-right.svg';
import {
	ScrollDirection,
	scrollOneStep
} from '../hoverScrollArrows/HoverScrollArrows';

/**
 * Horizontally scrolling row of format cards with a round "previous" and
 * "next" button underneath (Figma "Create New Conversation", node 7633-34734).
 *
 * The cards keep a fixed width and minimum height (`.formatCard` in
 * `conversationCreate.styles.scss`), so a narrow column scrolls instead of
 * squeezing the cards until their buttons truncate. The buttons only appear
 * while there is something to scroll, and are disabled at either end.
 *
 * Unlike `HoverScrollArrows` (desktop-only overlay that appears on hover),
 * these are the always-visible pill buttons Figma draws under the row, so
 * they work on touch screens too. Both share `scrollOneStep`, which moves
 * the row to the next snap position.
 */

/** Sub-pixel scroll positions must not leave a button enabled at the end. */
const EDGE_TOLERANCE_PX = 2;

interface FormatCardCarouselProps {
	children: React.ReactNode;
	className?: string;
}

export const FormatCardCarousel = ({
	children,
	className
}: FormatCardCarouselProps) => {
	const { t } = useTranslation();
	const scrollerRef = useRef<HTMLDivElement | null>(null);
	const [edges, setEdges] = useState({
		overflowing: false,
		atStart: true,
		atEnd: true
	});

	const measure = useCallback(() => {
		const scroller = scrollerRef.current;
		if (!scroller) {
			return;
		}
		const maxScroll = scroller.scrollWidth - scroller.clientWidth;
		const next = {
			overflowing: maxScroll > EDGE_TOLERANCE_PX,
			atStart: scroller.scrollLeft <= EDGE_TOLERANCE_PX,
			atEnd: scroller.scrollLeft >= maxScroll - EDGE_TOLERANCE_PX
		};
		setEdges((current) =>
			current.overflowing === next.overflowing &&
			current.atStart === next.atStart &&
			current.atEnd === next.atEnd
				? current
				: next
		);
	}, []);

	useEffect(() => {
		const scroller = scrollerRef.current;
		if (!scroller) {
			return undefined;
		}
		measure();
		if (typeof ResizeObserver === 'undefined') {
			return undefined;
		}
		// Cards mounting/unmounting changes scrollWidth, the window changes
		// clientWidth: observe both the row and its cards.
		const observer = new ResizeObserver(measure);
		observer.observe(scroller);
		Array.from(scroller.children).forEach((child) =>
			observer.observe(child)
		);
		return () => observer.disconnect();
	}, [measure, children]);

	const scrollByCard = (direction: ScrollDirection) => {
		const scroller = scrollerRef.current;
		if (scroller) {
			scrollOneStep(scroller, direction);
		}
	};

	return (
		<div
			className={`formatCardCarousel${className ? ` ${className}` : ''}`}
		>
			<div
				ref={scrollerRef}
				className="formatCardCarousel__scroller"
				onScroll={measure}
			>
				{children}
			</div>
			{edges.overflowing && (
				<div className="formatCardCarousel__controls">
					<button
						type="button"
						className="formatCardCarousel__button"
						aria-label={t('groupChat.format.cardsPrevious')}
						disabled={edges.atStart}
						onClick={() => scrollByCard(-1)}
					>
						<ArrowLeftIcon aria-hidden />
					</button>
					<button
						type="button"
						className="formatCardCarousel__button"
						aria-label={t('groupChat.format.cardsNext')}
						disabled={edges.atEnd}
						onClick={() => scrollByCard(1)}
					>
						<ArrowRightIcon aria-hidden />
					</button>
				</div>
			)}
		</div>
	);
};
