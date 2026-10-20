import * as React from 'react';
import { Box, SxProps, Theme } from '@mui/material';
import { transitionMotion } from './transitionMotion';

export type SlideFrom = 'right' | 'left' | 'below';
type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type SlideFromProp =
	| SlideFrom
	| Partial<Record<Breakpoint, SlideFrom>>;

const ANIMATION: Record<SlideFrom, string> = {
	right: 'slideInFromRight',
	left: 'slideInFromLeft',
	below: 'slideInFromBelow'
};

const animationFor = (from: SlideFrom, ms: number) =>
	`${ANIMATION[from]} ${ms}ms ${transitionMotion.easeIn} both`;

export interface SlideInProps {
	from: SlideFromProp;
	/** How far it travels; a whole column is `100%`, a step inside it less. */
	distance?: string;
	durationMs?: number;
	/** False renders the view in place, for the one that is simply there first. */
	animate?: boolean;
	sx?: SxProps<Theme>;
	'data-cy'?: string;
	children: React.ReactNode;
}

/**
 * A view that arrives by sliding in. Mount it with a new `key` per view and
 * only that view moves; the frame and the stage around it stay mounted. The
 * direction is the only choice a caller makes — duration and easing are the
 * platform's. Reduced motion shows the view in place.
 */
export const SlideIn = ({
	from,
	distance = '100%',
	durationMs = transitionMotion.viewMs,
	animate = true,
	sx,
	children,
	...rest
}: SlideInProps) => {
	const animation =
		typeof from === 'string'
			? animationFor(from, durationMs)
			: Object.fromEntries(
					Object.entries(from).map(([breakpoint, direction]) => [
						breakpoint,
						animationFor(direction, durationMs)
					])
				);

	return (
		<Box
			data-cy={rest['data-cy']}
			data-slide-from={
				typeof from === 'string' ? from : JSON.stringify(from)
			}
			sx={[
				{
					'--slide-distance': distance,
					'flex': 1,
					'display': 'flex',
					'flexDirection': 'column',
					'minWidth': 0,
					'animation': animate ? animation : 'none',
					'@keyframes slideInFromRight': {
						from: {
							transform: 'translateX(var(--slide-distance))',
							opacity: 0
						},
						to: { transform: 'none', opacity: 1 }
					},
					'@keyframes slideInFromLeft': {
						from: {
							transform: 'translateX(calc(var(--slide-distance) * -1))',
							opacity: 0
						},
						to: { transform: 'none', opacity: 1 }
					},
					'@keyframes slideInFromBelow': {
						from: {
							transform: 'translateY(var(--slide-distance))',
							opacity: 0
						},
						to: { transform: 'none', opacity: 1 }
					},
					'@media (prefers-reduced-motion: reduce)': {
						animation: 'none'
					}
				},
				...(Array.isArray(sx) ? sx : sx ? [sx] : [])
			]}
		>
			{children}
		</Box>
	);
};
