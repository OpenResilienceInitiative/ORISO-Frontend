import * as React from 'react';
import { Box, Typography } from '@mui/material';

export interface StageMobileHeroProps {
	/** Small mark in the top left, e.g. "Beratung & Hilfe". */
	title: string;
	/** The large two-line invitation. */
	headline: string;
	/** The claim under it, e.g. "Online. Anonym. Sicher." */
	claim: string;
	/** Language control, rendered in the translucent circle top right. */
	action?: React.ReactNode;
}

const HERO_HEIGHT = 230;

/**
 * The mobile login head (design 2e).
 *
 * Not the desktop stage scaled down: no wave pattern, no canvas, no cursor
 * light — a phone pays for those in battery and mobile data. What is left is a
 * radial gradient plus two hairline rings, all CSS, and the white sheet below
 * overlaps it by 28 px.
 */
export const StageMobileHero = ({
	title,
	headline,
	claim,
	action
}: StageMobileHeroProps) => (
	<Box
		sx={{
			position: 'relative',
			height: HERO_HEIGHT,
			flex: 'none',
			overflow: 'hidden',
			background:
				'radial-gradient(120% 90% at 78% 8%, var(--m3-primary-container, #e0313b) 0%, var(--m3-primary, #c0121f) 42%, var(--m3-primary-hover, #8c0e17) 78%, #6f0a11 100%)'
		}}
	>
		<Box
			aria-hidden
			sx={{
				position: 'absolute',
				inset: 0,
				background:
					'radial-gradient(60% 50% at 18% 92%, rgba(255,180,168,0.22), rgba(255,180,168,0) 70%)',
				pointerEvents: 'none'
			}}
		/>
		<Box
			aria-hidden
			sx={{
				position: 'absolute',
				right: '-70px',
				top: '-90px',
				width: 260,
				height: 260,
				borderRadius: '50%',
				border: '1px solid rgba(255,255,255,0.16)',
				pointerEvents: 'none'
			}}
		/>
		<Box
			aria-hidden
			sx={{
				position: 'absolute',
				right: '-20px',
				top: '-40px',
				width: 160,
				height: 160,
				borderRadius: '50%',
				border: '1px solid rgba(255,255,255,0.12)',
				pointerEvents: 'none'
			}}
		/>

		<Box
			sx={{
				position: 'absolute',
				top: '14px',
				left: '20px',
				right: '20px',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'space-between',
				gap: 1
			}}
		>
			{/* Typography resolves to text.primary unless told otherwise, and
			    text.primary on this red is unreadable — every line here names
			    its own colour. */}
			<Typography
				component="span"
				sx={{
					fontSize: 17,
					fontWeight: 600,
					lineHeight: 1.2,
					color: 'var(--m3-on-primary, #ffffff)'
				}}
			>
				{title}
			</Typography>
			{action && (
				<Box
					sx={{
						'display': 'flex',
						'alignItems': 'center',
						'justifyContent': 'center',
						'width': 34,
						'height': 34,
						'flex': 'none',
						'borderRadius': '999px',
						'backgroundColor': 'rgba(255,255,255,0.14)',
						'color': 'var(--m3-on-primary, #ffffff)',
						'& .MuiSvgIcon-root': { fontSize: 19 }
					}}
				>
					{action}
				</Box>
			)}
		</Box>

		<Box
			sx={{
				position: 'absolute',
				left: '24px',
				right: '24px',
				bottom: '52px'
			}}
		>
			<Typography
				component="h1"
				sx={{
					fontSize: 27,
					fontWeight: 600,
					letterSpacing: '-0.5px',
					lineHeight: 1.15,
					// The headline is authored with its line break, because
					// where it falls is a design decision and every language
					// breaks in a different place.
					whiteSpace: 'pre-line',
					color: 'var(--m3-on-primary, #ffffff)'
				}}
			>
				{headline}
			</Typography>
			<Typography
				component="p"
				sx={{
					mt: '6px',
					fontSize: 14,
					lineHeight: 1.4,
					color: 'rgba(255,255,255,0.9)'
				}}
			>
				{claim}
			</Typography>
		</Box>
	</Box>
);
