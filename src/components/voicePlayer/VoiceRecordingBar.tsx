import * as React from 'react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { formatClock, getTileLayout } from './voicePlayerLayout';

import './voicePlayer.styles';

export interface VoiceRecordingBarProps {
	/** Seconds recorded so far. */
	durationSec: number;
	onStop: () => void;
	/**
	 * FE#2494: when given, the round button pauses and resumes the take
	 * instead of stopping it (the answer field stops it on stack/send).
	 */
	onPause?: () => void;
	paused?: boolean;
	className?: string;
}

/**
 * A voice note while it is being recorded. Same row as the VoicePlayer, so
 * Stop turns into Play in place: one tile grows per recorded second and the
 * tiles carry over into the review.
 */
export const VoiceRecordingBar = ({
	durationSec,
	onStop,
	onPause,
	paused = false,
	className
}: VoiceRecordingBarProps) => {
	const { t: translate } = useTranslation();
	const { count } = useMemo(
		() => getTileLayout(durationSec, 'md'),
		[durationSec]
	);

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
					onClick={onPause ?? onStop}
					aria-label={translate(
						onPause
							? paused
								? 'voice.recording.resume'
								: 'voice.recording.pause'
							: 'app.stop'
					)}
					title={translate(
						onPause
							? paused
								? 'voice.recording.resume'
								: 'voice.recording.pause'
							: 'app.stop'
					)}
					aria-pressed={onPause ? paused : undefined}
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
						{!onPause ? (
							<rect x="5" y="5" width="14" height="14" rx="2" />
						) : paused ? (
							<circle cx="12" cy="12" r="7" />
						) : (
							<>
								<rect
									x="6"
									y="5"
									width="4"
									height="14"
									rx="1"
								/>
								<rect
									x="14"
									y="5"
									width="4"
									height="14"
									rx="1"
								/>
							</>
						)}
					</svg>
				</button>
				<div className="voicePlayer__tiles" aria-hidden="true">
					{Array.from({ length: count }, (_, index) => (
						<span
							key={index}
							className={[
								'voicePlayer__tile',
								'voicePlayer__tile--played',
								index === count - 1
									? 'voicePlayer__tile--live'
									: null
							]
								.filter(Boolean)
								.join(' ')}
						/>
					))}
				</div>
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
