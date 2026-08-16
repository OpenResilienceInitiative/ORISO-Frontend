import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, ButtonBase, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { registrationMd3 } from '../../registration/registrationDesign/registrationDesign';
import {
	artworkFit,
	processArtwork,
	RegistrationArtworkEntry
} from '../../../resources/img/registration-md3/registrationArtwork';

interface HandoverStep {
	key: string;
	artwork: RegistrationArtworkEntry;
	titleFallback: string;
	textFallback: string;
}

const STEPS: HandoverStep[] = [
	{
		key: 'write',
		artwork: processArtwork.write,
		titleFallback: 'Sie schreiben, was los ist',
		textFallback: 'Was ist passiert, wo, seit wann? Ein paar Sätze genügen.'
	},
	{
		key: 'counsellor',
		artwork: processArtwork.counsellor,
		titleFallback: 'Wir finden Ihre Beraterin',
		textFallback: 'Fachlich passend — und mit Zeit für Sie.'
	},
	{
		key: 'reply',
		artwork: processArtwork.reply,
		titleFallback: 'Antwort in 2 Arbeitstagen',
		textFallback:
			'Auf Ihre Anfrage wird persönlich und professionell geantwortet.'
	}
];

export interface HandoverCarouselProps {
	/** Called once every card image has settled (loaded or failed). */
	onArtworkSettled?: () => void;
}

/**
 * "So geht es weiter" — three cards the user swipes through while the app
 * finishes loading behind the gate button.
 *
 * Only the first motif is fetched eagerly; the other two are lazy. Every image
 * box reserves its aspect ratio up front, so a slow image never shifts the text
 * the user is already reading.
 */
export const HandoverCarousel = ({
	onArtworkSettled
}: HandoverCarouselProps) => {
	const { t } = useTranslation();
	const trackRef = useRef<HTMLDivElement>(null);
	const [activeIndex, setActiveIndex] = useState(0);
	const settledCount = useRef(0);

	const noteSettled = useCallback(() => {
		settledCount.current += 1;
		if (settledCount.current >= STEPS.length) {
			onArtworkSettled?.();
		}
	}, [onArtworkSettled]);

	useEffect(() => {
		const track = trackRef.current;
		if (!track) {
			return undefined;
		}

		const onScroll = () => {
			// Read the real card positions rather than an averaged card
			// width: where several cards fit at once, the browser clamps
			// scrollLeft well before the averaged target for the last card,
			// and the dot then reported a step the user was not on.
			const cards = Array.from(track.children) as HTMLElement[];
			if (!cards.length) {
				return;
			}
			const centre = track.scrollLeft + track.clientWidth / 2;
			let nearest = 0;
			let best = Infinity;
			cards.forEach((card, index) => {
				const cardCentre = card.offsetLeft + card.offsetWidth / 2;
				const distance = Math.abs(cardCentre - centre);
				if (distance < best) {
					best = distance;
					nearest = index;
				}
			});
			setActiveIndex(nearest);
		};

		track.addEventListener('scroll', onScroll, { passive: true });
		return () => track.removeEventListener('scroll', onScroll);
	}, []);

	const scrollTo = (index: number) => {
		const track = trackRef.current;
		const card = track?.children[index] as HTMLElement | undefined;
		if (!track || !card) {
			return;
		}
		const reducedMotion =
			typeof window.matchMedia === 'function' &&
			window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		// Centre the card the dot stands for; `offsetLeft` alone would push
		// the last card against the right edge where it cannot scroll.
		track.scrollTo({
			left: card.offsetLeft - (track.clientWidth - card.offsetWidth) / 2,
			behavior: reducedMotion ? 'auto' : 'smooth'
		});
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
					'&::-webkit-scrollbar': { display: 'none' }
				}}
			>
				{STEPS.map((step, index) => (
					<Box
						key={step.key}
						component="li"
						data-cy={`handover-card-${step.key}`}
						sx={{
							flex: 'none',
							width: { xs: 250, sm: 264 },
							scrollSnapAlign: { xs: 'center', sm: 'start' },
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
								alt=""
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
									`registration.handover.steps.${step.key}.title`,
									step.titleFallback
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
									`registration.handover.steps.${step.key}.text`,
									step.textFallback
								)}
							</Typography>
						</Box>
					</Box>
				))}
			</Box>

			<Box
				sx={{
					flex: 'none',
					display: 'flex',
					justifyContent: 'center',
					gap: 0.875,
					pt: { xs: 1.5, sm: 2 }
				}}
			>
				{STEPS.map((step, index) => (
					<ButtonBase
						key={step.key}
						onClick={() => scrollTo(index)}
						aria-label={t('registration.handover.goToStep', {
							position: index + 1,
							total: STEPS.length,
							defaultValue:
								'Zu Schritt {{position}} von {{total}}'
						})}
						aria-current={index === activeIndex}
						sx={{
							'width': index === activeIndex ? 22 : 6,
							'height': 6,
							'borderRadius': 3,
							'bgcolor':
								index === activeIndex
									? registrationMd3.primary
									: registrationMd3.outlineVariant,
							'transition': 'width 200ms ease',
							// A 6px dot needs the ring set off from it, or the
							// keyboard user cannot see where they are.
							'&.Mui-focusVisible': {
								outline: `2px solid ${registrationMd3.focus}`,
								outlineOffset: 4
							},
							'@media (prefers-reduced-motion: reduce)': {
								transition: 'none'
							}
						}}
					/>
				))}
			</Box>
		</Box>
	);
};
