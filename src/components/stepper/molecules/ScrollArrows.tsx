import * as React from 'react';
import { RefObject, useCallback, useEffect, useState } from 'react';
import { Box, IconButton } from '@mui/material';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import { stepperColors } from '../stepperDesign';

export interface ScrollArrowsProps {
	rowRef: RefObject<HTMLElement | null>;
	labels: { back: string; forward: string };
	/** Re-measure when this changes (e.g. the current step scrolled into view). */
	watch?: unknown;
}

/**
 * Gallery arrows over the edges of a row that scrolls sideways: each shows only while there is
 * more to that side, and a press moves the row by most of its width. The row stays scrollable
 * by touch and trackpad; the arrows are for the mouse and the keyboard.
 */
export const ScrollArrows = ({ rowRef, labels, watch }: ScrollArrowsProps) => {
	const [edges, setEdges] = useState({ back: false, forward: false });
	const measure = useCallback(() => {
		const row = rowRef.current;
		if (!row) return;
		setEdges({
			back: row.scrollLeft > 4,
			forward: row.scrollLeft + row.clientWidth < row.scrollWidth - 4
		});
	}, [rowRef]);

	useEffect(() => {
		const row = rowRef.current;
		if (!row) return undefined;
		measure();
		// After the smooth scroll that brings the current step into view.
		const settle = window.setTimeout(measure, 450);
		row.addEventListener('scroll', measure, { passive: true });
		window.addEventListener('resize', measure);
		return () => {
			window.clearTimeout(settle);
			row.removeEventListener('scroll', measure);
			window.removeEventListener('resize', measure);
		};
	}, [rowRef, measure, watch]);

	const move = (direction: -1 | 1) => {
		const row = rowRef.current;
		if (!row) return;
		row.scrollBy({ left: direction * row.clientWidth * 0.8 });
	};

	const arrow = (side: 'back' | 'forward') => (
		<Box
			sx={{
				position: 'absolute',
				top: 0,
				bottom: 0,
				[side === 'back' ? 'left' : 'right']: 0,
				display: edges[side] ? 'flex' : 'none',
				alignItems: 'flex-start',
				pt: '2px',
				px: 0.5,
				// The row fades under the arrow, so it reads as "more this way".
				background: `linear-gradient(${side === 'back' ? 'to right' : 'to left'}, var(--m3-background, #fcf9f9) 55%, transparent)`
			}}
		>
			<IconButton
				size="small"
				aria-label={labels[side]}
				onClick={() => move(side === 'back' ? -1 : 1)}
				data-cy={`icon-stepper-scroll-${side}`}
				sx={{
					'width': 40,
					'height': 40,
					'backgroundColor': stepperColors.surfaceContainerHighest,
					'color': stepperColors.onSurfaceVariant,
					'boxShadow':
						'0 2px 6px color-mix(in srgb, var(--m3-shadow, #000000) 16%, transparent)',
					'&:hover': {
						backgroundColor: stepperColors.surfaceContainerHighest
					}
				}}
			>
				{side === 'back' ? (
					<ChevronLeftRoundedIcon />
				) : (
					<ChevronRightRoundedIcon />
				)}
			</IconButton>
		</Box>
	);

	return (
		<>
			{arrow('back')}
			{arrow('forward')}
		</>
	);
};
