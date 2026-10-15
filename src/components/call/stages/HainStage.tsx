import React from 'react';

import { AnimalAvatar } from '../../pseudonym/AnimalAvatar';
import { type Avatar } from '../../../utils/pseudonymGenerator';
import { packShapes } from '../engine/layout';

/**
 * One participant, as the call knows them.
 *
 * The identity is INHERITED, never derived here. Animal, background and ink
 * come from the account — `chosenAvatarOf` / the anonymous-name engine — and
 * this component only places them. Deriving a colour from a hash of the user
 * id would give the same person a different colour in the call than in the
 * rest of ORISO, which is the one thing a call surface must not do.
 */
export interface CallParticipant {
	/** Stable key the silhouette is seeded from — the displayed name. */
	name: string;
	avatar: Avatar;
	speaking?: boolean;
}

export interface HainStageProps {
	participants: readonly CallParticipant[];
	/** The stage is a square; the arrangements are built around one. */
	box: number;
}

/** A speaker's share, relative to a quiet participant's 1. */
export const SPEAKING_WEIGHT = 1.6;

/**
 * The Hain (4a) — the handoff's primary arrangement.
 *
 * Placement comes from `packShapes`, which is the prototype's own function,
 * unchanged. Speaking is weight, not a badge: the shape grows and physically
 * displaces the others, so the field re-settles when the turn passes on.
 */
export const HainStage: React.FC<HainStageProps> = ({ participants, box }) => {
	const placed = packShapes(
		participants.map((p) => p.name),
		box,
		participants.map((p) => (p.speaking ? SPEAKING_WEIGHT : 1))
	);

	return (
		<div
			data-testid="hain-stage"
			style={{ position: 'relative', width: box, height: box }}
		>
			{placed.map((spot, i) => (
				<div
					key={participants[i].name}
					data-testid="participant"
					style={{
						position: 'absolute',
						left: spot.x,
						top: spot.y
					}}
				>
					<AnimalAvatar
						avatar={participants[i].avatar}
						size={spot.size}
						outline={false}
						radius={spot.blob}
						tilt={Number(spot.tilt)}
					/>
				</div>
			))}
		</div>
	);
};
