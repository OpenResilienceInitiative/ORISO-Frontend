import React from 'react';

import { AnimalAvatar } from '../../pseudonym/AnimalAvatar';
import { NamePill } from '../atoms/NamePill';
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
	micOff?: boolean;
	/** Milliseconds since the hand went up, or null if it is down. */
	handRaisedForMs?: number | null;
}

export interface HainStageProps {
	participants: readonly CallParticipant[];
	/** The stage is a square; the arrangements are built around one. */
	box: number;
}

/** A speaker's share, relative to a quiet participant's 1. */
export const SPEAKING_WEIGHT = 1.6;

/**
 * Where the name sits on a Hain shape, and when it is dropped.
 *
 * Both numbers are the handoff's: "On the status rail at the bottom of the
 * shape, `bottom: 7%` of the shape's size, centred ... Hidden below 84 px
 * shape size." The second one matters more than it looks — a 26 px capsule
 * on a 70 px shape covers the animal, and at that size the colour and the
 * silhouette are doing the identifying anyway.
 */
export const NAME_BOTTOM_SHARE = 0.07;
export const NAME_MIN_SHAPE = 84;

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
						top: spot.y,
						width: spot.size,
						height: spot.size
					}}
				>
					<AnimalAvatar
						avatar={participants[i].avatar}
						size={spot.size}
						outline={false}
						radius={spot.blob}
						tilt={Number(spot.tilt)}
					/>
					{spot.size >= NAME_MIN_SHAPE && (
						<span
							style={{
								position: 'absolute',
								insetBlockEnd: spot.size * NAME_BOTTOM_SHARE,
								insetInline: 0,
								// Above every shape on the stage, not just its
								// own. The slots are absolutely positioned
								// siblings with no z-index, so a later one
								// paints over an earlier one's name — measured
								// in Chromium: one name per nine-person room.
								zIndex: 1,
								display: 'flex',
								justifyContent: 'center',
								pointerEvents: 'none'
							}}
						>
							<NamePill
								name={participants[i].name}
								speaking={participants[i].speaking}
								micOff={participants[i].micOff}
								handRaisedForMs={
									participants[i].handRaisedForMs
								}
							/>
						</span>
					)}
				</div>
			))}
		</div>
	);
};
