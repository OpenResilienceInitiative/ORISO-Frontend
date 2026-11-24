import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { formatClock } from './voicePlayerLayout';
import { VoiceLevelDots } from './VoiceLevelDots';

import './voicePlayer.styles';

export interface VoiceRecordingBarProps {
	/** Seconds recorded so far. */
	durationSec: number;
	onStop: () => void;
	/**
	 * The microphone being recorded. Drives the level dots; without it the
	 * dots stay at rest, still visible.
	 */
	stream?: MediaStream | null;
	/** Fixed levels instead of the microphone (Storybook). */
	levels?: readonly number[];
	className?: string;
}

/**
 * A voice note while it is being recorded. Same row as the VoicePlayer, so
 * Stop turns into Play in place. The middle shows the live voice level as a
 * row of dots that is always there, so a quiet moment still reads as
 * "recording" and never as "broken".
 */
export const VoiceRecordingBar = ({
	durationSec,
	onStop,
	stream,
	levels,
	className
}: VoiceRecordingBarProps) => {
	const { t: translate } = useTranslation();

	return (
		<div
			className={[
				'voicePlayer',
				'voicePlayer--tiles',
				'voicePlayer--md',
				'voicePlayer--bubble-incoming',
				'voicePlayer--recording',
				className
			]
				.filter(Boolean)
				.join(' ')}
		>
			<div className="voicePlayer__row">
				<button
					type="button"
					className="voicePlayer__toggle voicePlayer__toggle--tiles"
					onClick={onStop}
					aria-label={translate('app.stop')}
					title={translate('app.stop')}
				>
					<svg
						width={14}
						height={14}
						viewBox="0 0 24 24"
						fill="currentColor"
						aria-hidden="true"
						focusable="false"
						className="voicePlayer__icon"
					>
						<rect x="5" y="5" width="14" height="14" rx="2" />
					</svg>
				</button>
				<VoiceLevelDots
					stream={stream}
					levels={levels}
					state="recording"
				/>
				<span className="voicePlayer__clock">
					{formatClock(durationSec)}
				</span>
				<span className="sr-only" role="status">
					{translate('voice.recording.active')}
				</span>
			</div>
		</div>
	);
};
