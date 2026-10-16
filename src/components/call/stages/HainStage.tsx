import React from 'react';

import { AnimalAvatar } from '../../pseudonym/AnimalAvatar';
import { NamePill } from '../atoms/NamePill';
import { type AtmosphereName, Atmosphere } from '../atmosphere/Atmosphere';
import { type Avatar } from '../../../utils/pseudonymGenerator';
import { packShapes } from '../engine/layout';
import { HALO_LIFT_PX, haloFor } from './halo';

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
	/**
	 * The backdrop world. Chosen centrally by the counselling centre — never
	 * by an advice seeker, and by a counsellor only from what the centre has
	 * configured. Omitted here means a plain stage, which is what a story or
	 * a test wants.
	 */
	atmosphere?: AtmosphereName;
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
/**
 * The layer the speaking shape rises onto, and the one every name capsule
 * sits above.
 *
 * Two numbers rather than one, because they are in tension: the handoff
 * wants the speaker in front of the others, and the capsules must stay
 * readable over all of it. A capsule on the same layer as the risen shape
 * disappears behind its neighbour.
 */
export const SPEAKING_LAYER = 3;
export const NAME_LAYER = 4;

/** The speaker rises rather than snapping. */
export const SPEAKING_EASING = '0.32s cubic-bezier(0.2, 0, 0, 1)';

export const NAME_MIN_SHAPE = 84;

/**
 * How wide a name capsule may get on a Hain shape.
 *
 * The handoff's flat 132px counts the glyphs as well, so a raised hand with
 * its duration left about forty pixels for the name — "naher O…" instead of
 * "naher Otter 303". A pseudonym lives on the number at the end, so that
 * truncation cut away the identifying part.
 *
 * Two ceilings instead, whichever is lower. The absolute one keeps a long
 * name from becoming a banner. The relative one is the real rule: a capsule
 * wider than its own shape hangs over the neighbours, and this arrangement
 * packs shapes until they abut. The ellipsis stays behind both.
 */
export const NAME_MAX_PX = 208;
export const NAME_SHAPE_SHARE = 0.92;

/** The capsule's ceiling on a shape of this size. */
export const nameMaxWidth = (shapeSize: number): number =>
	Math.round(Math.min(NAME_MAX_PX, shapeSize * NAME_SHAPE_SHARE));

/**
 * The Hain (4a) — the handoff's primary arrangement.
 *
 * Placement comes from `packShapes`, which is the prototype's own function,
 * unchanged. Speaking is weight, not a badge: the shape grows and physically
 * displaces the others, so the field re-settles when the turn passes on.
 */
export const HainStage: React.FC<HainStageProps> = ({
	participants,
	box,
	atmosphere
}) => {
	const placed = packShapes(
		participants.map((p) => p.name),
		box,
		participants.map((p) => (p.speaking ? SPEAKING_WEIGHT : 1))
	);

	return (
		<div
			data-testid="hain-stage"
			style={{
				position: 'relative',
				width: box,
				height: box,
				overflow: 'hidden'
			}}
		>
			{atmosphere !== undefined && <Atmosphere palette={atmosphere} />}
			{placed.map((spot, i) => (
				<div
					key={participants[i].name}
					data-testid="participant"
					style={{
						position: 'absolute',
						left: spot.x,
						top: spot.y,
						width: spot.size,
						height: spot.size,
						// Risen out of the field, and in front of the
						// others. Only the speaker gets a z-index: giving
						// every slot one would make each a stacking context
						// and trap its name capsule inside it, which is the
						// bug the capsule's own z-index exists to prevent.
						...(participants[i].speaking
							? {
									transform: `translateY(-${HALO_LIFT_PX}px)`,
									zIndex: SPEAKING_LAYER
								}
							: {}),
						transition: `transform ${SPEAKING_EASING}`
					}}
				>
					<AnimalAvatar
						avatar={participants[i].avatar}
						size={spot.size}
						outline={false}
						// The handoff gives the Hain its two shadow stacks
						// outright, so the scaled lift does not apply here.
						shadow={haloFor(
							participants[i].avatar.bg,
							Boolean(participants[i].speaking)
						)}
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
								// Above the risen speaker too, which sits on
								// SPEAKING_LAYER.
								zIndex: NAME_LAYER,
								display: 'flex',
								justifyContent: 'center',
								pointerEvents: 'none'
							}}
						>
							<NamePill
								maxWidth={nameMaxWidth(spot.size)}
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
