import * as React from 'react';

import { AnimalAvatar, liftFor } from '../../pseudonym/AnimalAvatar';
import { NamePill } from '../atoms/NamePill';
import { type AtmosphereName, Atmosphere } from '../atmosphere/Atmosphere';
import { splitCells } from '../engine/layout';
import { type CallParticipant } from './HainStage';
import { FELDER_MAX_SPLIT, orderForFelder, splitsInto } from './felder';
import styles from './felderStage.module.scss';

/** The handoff's gutter and corner for a field. */
export const FIELD_GUTTER = 6;
export const FIELD_RADIUS = 24;

/** The fixed tile beyond eight people, when the stage starts scrolling. */
export const TILE_MIN_WIDTH = 220;
export const TILE_ASPECT = 4 / 3;

export interface FelderStageProps {
	participants: readonly CallParticipant[];
	width: number;
	height: number;
	atmosphere?: AtmosphereName;
}

/** The weight a speaker's branch carries through the recursive cut. */
const speakerIndexOf = (participants: readonly CallParticipant[]): number =>
	participants.findIndex((p) => p.speaking);

const Field: React.FC<{
	participant: CallParticipant;
	width: number;
	height: number;
}> = ({ participant, width, height }) => (
	<div
		data-testid="field"
		className={styles.field}
		// The lift goes on the TILE. The avatar inside is the same colour as
		// the tile and invisible by design; giving it the shadow drew a pale
		// disc behind every animal.
		style={{
			background: participant.avatar.bg,
			boxShadow: liftFor(Math.min(width, height))
		}}
	>
		<AnimalAvatar
			avatar={participant.avatar}
			size={Math.round(Math.min(width, height) * 0.56)}
			outline={false}
		/>
		<span className={styles.label}>
			<NamePill
				name={participant.name}
				speaking={participant.speaking}
				micOff={participant.micOff}
				handRaisedForMs={participant.handRaisedForMs}
				maxWidth={Math.round(width - 24)}
			/>
		</span>
	</div>
);

/**
 * The Felder view (4b) — the rectilinear counterpart to the Hain.
 *
 * Up to eight people the surface subdivides recursively with `splitCells`,
 * the prototype's own function, and the speaker's branch keeps the larger
 * share of every cut it is on. Beyond eight the ticket says to stop: a fixed
 * tile, a scrolling container, and speakers moved to the top.
 *
 * The re-sort is stable for everybody else. A comparator that reshuffles the
 * quiet participants whenever somebody starts talking makes a room of twenty
 * unreadable — see `felder.ts`.
 */
export const FelderStage: React.FC<FelderStageProps> = ({
	participants,
	width,
	height,
	atmosphere
}) => {
	const scrolls = !splitsInto(participants.length);

	const ordered = React.useMemo(
		() =>
			scrolls
				? orderForFelder(
						participants,
						participants.filter((p) => p.speaking)
					)
				: participants,
		[participants, scrolls]
	);

	return (
		<div
			data-testid="felder-stage"
			data-mode={scrolls ? 'scroll' : 'split'}
			className={scrolls ? styles.scrolling : styles.stage}
			style={{ width, height }}
		>
			{atmosphere !== undefined && <Atmosphere palette={atmosphere} />}

			{scrolls
				? ordered.map((p) => (
						<div
							key={p.name}
							className={styles.tile}
							style={{
								inlineSize: TILE_MIN_WIDTH,
								blockSize: Math.round(
									TILE_MIN_WIDTH / TILE_ASPECT
								)
							}}
						>
							<Field
								participant={p}
								width={TILE_MIN_WIDTH}
								height={Math.round(
									TILE_MIN_WIDTH / TILE_ASPECT
								)}
							/>
						</div>
					))
				: splitCells(
						participants.map((_, i) => i),
						{ x: 0, y: 0, w: width, h: height },
						speakerIndexOf(participants)
					).map((cell) => (
						<div
							key={participants[cell.i].name}
							className={styles.cell}
							style={{
								insetInlineStart: cell.x + FIELD_GUTTER / 2,
								insetBlockStart: cell.y + FIELD_GUTTER / 2,
								inlineSize: Math.max(1, cell.w - FIELD_GUTTER),
								blockSize: Math.max(1, cell.h - FIELD_GUTTER)
							}}
						>
							<Field
								participant={participants[cell.i]}
								width={cell.w - FIELD_GUTTER}
								height={cell.h - FIELD_GUTTER}
							/>
						</div>
					))}
		</div>
	);
};

export { FELDER_MAX_SPLIT };
