import * as React from 'react';
import { Box } from '@mui/material';

/* M3 emphasized decelerate: the entering view arrives fast and settles. */
const EASING = 'cubic-bezier(0.05, 0.7, 0.1, 1)';

/**
 * One view of the entry room — checking, the names, closed, the waiting room.
 *
 * Keyed by the view, so each change of view slides the new one in, while the
 * frame around it and the stage beside it stay mounted: on a desktop only the
 * white column moves (Frank, 2026-09-21: „nicht das ganze element neu
 * laden"). From the right on a desktop, from below on a phone — the direction
 * the column itself sits in relation to the stage.
 */
export const EntryRoomView = ({ children }: { children: React.ReactNode }) => (
	<Box
		data-cy="entry-room-view"
		sx={{
			'flex': 1,
			'display': 'flex',
			'flexDirection': 'column',
			'minWidth': 0,
			'animation': {
				xs: `entryRoomViewFromBelow 420ms ${EASING}`,
				lg: `entryRoomViewFromRight 420ms ${EASING}`
			},
			'@keyframes entryRoomViewFromRight': {
				from: { transform: 'translateX(100%)', opacity: 0 },
				to: { transform: 'none', opacity: 1 }
			},
			'@keyframes entryRoomViewFromBelow': {
				from: { transform: 'translateY(100%)', opacity: 0 },
				to: { transform: 'none', opacity: 1 }
			},
			'@media (prefers-reduced-motion: reduce)': { animation: 'none' }
		}}
	>
		{children}
	</Box>
);
