import * as React from 'react';
import { SlideIn } from '../../transition/SlideIn';

/**
 * One view of the entry room — checking, the names, closed, the waiting room.
 *
 * Keyed by the view, so each change of view slides the new one in, while the
 * frame around it and the stage beside it stay mounted: on a desktop only the
 * white column moves (Frank, 2026-09-21: „nicht das ganze element neu
 * laden"). From the right on a desktop, from below on a phone — the direction
 * the column itself sits in relation to the stage. The motion itself is the
 * platform's shared one (`transition/`), not this room's.
 */
export const EntryRoomView = ({ children }: { children: React.ReactNode }) => (
	<SlideIn data-cy="entry-room-view" from={{ xs: 'below', lg: 'right' }}>
		{children}
	</SlideIn>
);
