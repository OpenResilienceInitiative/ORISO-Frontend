import * as React from 'react';
import { useLayoutEffect, useRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, Typography } from '@mui/material';
import { expect, waitFor } from 'storybook/test';
import { HoverScrollArrows } from './HoverScrollArrows';
import { orisoInputColors } from '../form/orisoInputDesign';
import {
	expectArrowStepsOneCard,
	revealHoverArrow
} from './hoverScrollArrowsStoryPlay';

const CARDS = 6;
const CARD_WIDTH = 220;

/**
 * Any sideways-scrolling row, here six plain cards. `startAt` scrolls to a
 * card first (`'end'` = all the way), so each state can be looked at.
 */
const Row = ({ startAt = 0 }: { startAt?: number | 'end' }) => {
	const trackRef = useRef<HTMLUListElement>(null);
	useLayoutEffect(() => {
		const track = trackRef.current;
		if (!track) return;
		track.scrollLeft =
			startAt === 'end'
				? track.scrollWidth
				: (track.children[startAt] as HTMLElement).offsetLeft -
					track.offsetLeft;
	}, [startAt]);
	return (
		<Box sx={{ maxWidth: 640, p: 3 }}>
			<HoverScrollArrows targetRef={trackRef}>
				<Box
					ref={trackRef}
					component="ul"
					data-cy="demo-track"
					// A scrolling region a keyboard can reach (axe).
					tabIndex={0}
					aria-label="Beispielkarten"
					sx={{
						'flex': 1,
						'display': 'flex',
						'gap': 2,
						'm': 0,
						'p': 0,
						'listStyle': 'none',
						'overflowX': 'auto',
						'scrollSnapType': 'x mandatory',
						'scrollbarWidth': 'none',
						'&::-webkit-scrollbar': { display: 'none' }
					}}
				>
					{Array.from({ length: CARDS }, (_, index) => (
						<Box
							key={index}
							component="li"
							sx={{
								flex: 'none',
								width: CARD_WIDTH,
								height: 160,
								scrollSnapAlign: 'start',
								borderRadius: '20px',
								border: `1px solid ${orisoInputColors.outline}`,
								bgcolor: orisoInputColors.surfaceContainer,
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center'
							}}
						>
							<Typography
								sx={{
									fontSize: 32,
									fontWeight: 700,
									color: orisoInputColors.onSurfaceVariant
								}}
							>
								{index + 1}
							</Typography>
						</Box>
					))}
				</Box>
			</HoverScrollArrows>
		</Box>
	);
};

const doc = (canvasElement: HTMLElement) => canvasElement.ownerDocument;
const arrow = (canvasElement: HTMLElement, which: 'previous' | 'next') =>
	doc(canvasElement).querySelector(
		`[data-cy="hover-scroll-arrows-${which}"]`
	);

/**
 * Desktop arrows for every element that scrolls sideways (Frank,
 * 2026-11-11): hover near an edge, a translucent strip with a round arrow
 * fades in; a click moves one card. No arrow where there is nothing more to
 * see. Phones and tablets (no hover, coarse pointer) never get them.
 *
 * Move the mouse to the right or left edge of the row to try it.
 */
const meta: Meta = {
	title: 'Atoms/HoverScrollArrows',
	parameters: { layout: 'fullscreen' }
};

export default meta;

export const AtTheStart: StoryObj = {
	name: '1 — Am Anfang: nur rechts ein Pfeil',
	render: () => <Row />,
	play: async ({ canvasElement }) => {
		await waitFor(() => {
			expect(arrow(canvasElement, 'previous')).toBeNull();
			expect(arrow(canvasElement, 'next')).not.toBeNull();
		});
	}
};

export const InTheMiddle: StoryObj = {
	name: '2 — In der Mitte: Pfeile auf beiden Seiten',
	render: () => <Row startAt={2} />,
	play: async ({ canvasElement }) => {
		await waitFor(() => {
			expect(arrow(canvasElement, 'previous')).not.toBeNull();
			expect(arrow(canvasElement, 'next')).not.toBeNull();
		});
	}
};

export const AtTheEnd: StoryObj = {
	name: '3 — Am Ende: nur links ein Pfeil',
	render: () => <Row startAt="end" />,
	play: async ({ canvasElement }) => {
		await waitFor(() => {
			expect(arrow(canvasElement, 'previous')).not.toBeNull();
			expect(arrow(canvasElement, 'next')).toBeNull();
		});
	}
};

export const HoverRightEdge: StoryObj = {
	name: '4 — Maus am rechten Rand: Streifen und Pfeil sichtbar',
	render: () => <Row startAt={2} />,
	play: async ({ canvasElement }) => {
		await revealHoverArrow(canvasElement, 'end');
	}
};

export const HoverLeftEdge: StoryObj = {
	name: '5 — Maus am linken Rand: Streifen und Pfeil sichtbar',
	render: () => <Row startAt={2} />,
	play: async ({ canvasElement }) => {
		await revealHoverArrow(canvasElement, 'start');
	}
};

export const ClickMovesOneCard: StoryObj = {
	name: '6 — Klick auf „weiter“: eine Karte, dann erscheint links ein Pfeil',
	render: () => <Row />,
	play: async ({ canvasElement }) => {
		await expectArrowStepsOneCard(canvasElement, 'demo-track');
	}
};
