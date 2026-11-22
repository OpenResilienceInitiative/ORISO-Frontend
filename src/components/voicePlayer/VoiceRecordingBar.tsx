import * as React from 'react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { formatClock, getTileLayout } from './voicePlayerLayout';

import './voicePlayer.styles';

export interface VoiceRecordingBarProps {
	/** Seconds recorded so far. */
	durationSec: number;
	onStop: () => void;
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
