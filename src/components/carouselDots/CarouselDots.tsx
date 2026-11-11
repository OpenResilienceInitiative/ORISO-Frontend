import * as React from 'react';
import { Box, ButtonBase, SxProps, Theme } from '@mui/material';
import { registrationMd3 } from '../registration/registrationDesign/registrationDesign';

export interface CarouselDotsProps {
	/** How many slides the dots stand for. */
	'count': number;
	/** The slide that is currently in view. */
	'activeIndex': number;
	/** Called with the slide a dot stands for when the visitor picks it. */
	'onSelect': (index: number) => void;
	/** Accessible name of one dot, e.g. "Zu Schritt 2 von 3". */
	'getLabel': (index: number, count: number) => string;
	/** Hook for tests; the buttons are the container's direct children. */
	'data-cy'?: string;
	'sx'?: SxProps<Theme>;
}

/** The visible dot; the button around it is the larger hit area. */
const DOT = { size: 6, active: 22, hoverSize: 10, hoverActive: 32 };
/** WCAG 2.5.8 minimum target; the dots themselves stay small. */
const TARGET = 24;
const EASE = 'cubic-bezier(0.2, 0, 0, 1)';

/**
 * Page dots for a carousel: one per slide, the active one drawn as a pill.
 *
 * Every dot is a button with a 24 px target around the small mark, so it can
 * be hit with a mouse, not only with a keyboard. When the pointer comes near
 * the row, all dots grow together, which tells the visitor they can be
 * clicked; the active pill slides smoothly to its new place on every change.
 *
 * Stateless: the owner decides which slide is active (from its own scroll
 * position) and what selecting one does.
 */
export const CarouselDots = ({
	count,
	activeIndex,
	onSelect,
	getLabel,
	'data-cy': dataCy,
	sx
}: CarouselDotsProps) => {
	// Driven by pointer events rather than `:hover`: a touch tap must not
	// leave the row enlarged, and the state is testable.
	const [pointing, setPointing] = React.useState(false);
	return (
		<Box
			data-cy={dataCy}
			data-pointing={pointing || undefined}
			onPointerEnter={(event: React.PointerEvent) =>
				setPointing(event.pointerType !== 'touch')
			}
			onPointerLeave={() => setPointing(false)}
			sx={[
				{
					'display': 'flex',
					'justifyContent': 'center',
					'alignItems': 'center',
					'--dot-size': `${DOT.size}px`,
					'--dot-active': `${DOT.active}px`,
					'&[data-pointing]': {
						'--dot-size': `${DOT.hoverSize}px`,
						'--dot-active': `${DOT.hoverActive}px`
					}
				},
				...(Array.isArray(sx) ? sx : [sx])
			]}
		>
			{Array.from({ length: count }, (_, index) => {
				const active = index === activeIndex;
				return (
					<ButtonBase
						key={index}
						onClick={() => onSelect(index)}
						aria-label={getLabel(index, count)}
						aria-current={active}
						data-active={active}
						sx={{
							'minWidth': TARGET,
							'height': TARGET,
							'px': 0.25,
							'borderRadius': `${TARGET / 2}px`,
							'&::before': {
								content: '""',
								display: 'block',
								width: active
									? 'var(--dot-active)'
									: 'var(--dot-size)',
								height: 'var(--dot-size)',
								borderRadius: 'calc(var(--dot-size) / 2)',
								bgcolor: active
									? registrationMd3.primary
									: registrationMd3.outlineVariant,
								transition: `width 280ms ${EASE}, height 200ms ${EASE}, background-color 200ms ${EASE}`
							},
							'&:hover::before': {
								bgcolor: active
									? registrationMd3.primary
									: registrationMd3.outline
							},
							'&.Mui-focusVisible': {
								outline: `2px solid ${registrationMd3.focus}`,
								outlineOffset: 2
							},
							'@media (prefers-reduced-motion: reduce)': {
								'&::before': { transition: 'none' }
							}
						}}
					/>
				);
			})}
		</Box>
	);
};
