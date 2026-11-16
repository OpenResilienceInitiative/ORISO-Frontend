import * as React from 'react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { HoverScrollArrows } from '../hoverScrollArrows/HoverScrollArrows';

/**
 * Horizontally scrolling row of format cards with a round "previous" and
 * "next" button underneath (Figma "Create New Conversation", node 7633-34734).
 *
 * The cards keep a fixed width and minimum height (`.formatCard` in
 * `conversationCreate.styles.scss`), so a narrow column scrolls instead of
 * squeezing the cards until their buttons truncate. The arrows are the shared
 * `HoverScrollArrows` in its `below` placement: shown while the row
 * overflows, disabled at either end, one card per step.
 */

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

	return (
		<HoverScrollArrows
			targetRef={scrollerRef}
			placement="below"
			labels={{
				previous: t('groupChat.format.cardsPrevious'),
				next: t('groupChat.format.cardsNext')
			}}
			className={`formatCardCarousel${className ? ` ${className}` : ''}`}
			data-cy="format-card-carousel"
		>
			<div ref={scrollerRef} className="formatCardCarousel__scroller">
				{children}
			</div>
		</HoverScrollArrows>
	);
};
