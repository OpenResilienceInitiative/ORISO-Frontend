import * as React from 'react';

import { useVoiceLevels } from './useVoiceLevels';

import './voiceLevelDots.styles';

export type VoiceLevelState = 'idle' | 'recording' | 'paused' | 'stopped';

export const VOICE_LEVEL_DOT_COUNT = 20;

export interface VoiceLevelDotsProps {
	/** The live microphone. Read only while `state` is `recording`. */
	stream?: MediaStream | null;
	state: VoiceLevelState;
	/**
	 * Fixed levels (0…1, oldest first) instead of the microphone, for
	 * Storybook and tests.
	 */
	levels?: readonly number[];
	count?: number;
	className?: string;
}

/**
 * The level visual of the voice recorder: a row of small dots on a baseline
 * that is always there while recording, so silence still reads as "running".
 * Each dot grows into a red bar with the voice and falls back to a dot when
 * it is quiet. Owns its own audio analysis (see `useVoiceLevels`).
 */
export const VoiceLevelDots = ({
	stream,
	state,
	levels: fixedLevels,
	count = VOICE_LEVEL_DOT_COUNT,
	className
}: VoiceLevelDotsProps) => {
	const live = useVoiceLevels(
		stream,
		count,
		state === 'recording' && !fixedLevels
	);
	const levels =
		state === 'recording'
			? fixedLevels
				? fitToCount(fixedLevels, count)
				: live
			: Array<number>(count).fill(0);

	return (
		<div
			className={['voiceLevelDots', className].filter(Boolean).join(' ')}
			data-state={state}
			data-testid="voice-level-dots"
			aria-hidden="true"
		>
			{levels.map((level, index) => (
				<span
					key={index}
					className="voiceLevelDots__dot"
					data-level={level.toFixed(2)}
					style={
						{
							'--voice-level': clampLevel(level)
						} as React.CSSProperties
					}
				/>
			))}
		</div>
	);
};

const clampLevel = (level: number) =>
	Number.isFinite(level) ? Math.min(1, Math.max(0, level)) : 0;

const fitToCount = (levels: readonly number[], count: number): number[] => {
	const tail = levels.slice(-count);
	return [...Array<number>(count - tail.length).fill(0), ...tail];
};
