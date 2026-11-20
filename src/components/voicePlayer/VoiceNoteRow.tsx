import * as React from 'react';
import { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import CloseIcon from '@mui/icons-material/Close';

import { VoicePlayer } from './VoicePlayer';
import { VoiceRecordingBar } from './VoiceRecordingBar';

import './voicePlayer.styles';

export type VoiceNoteRowProps = {
	/** Cancels the recording, or discards the take under review. */
	onDiscard: () => void;
	className?: string;
} & (
	| {
			mode: 'recording';
			/** Seconds recorded so far. */
			durationSec: number;
			onStop: () => void;
	  }
	| {
			mode: 'review';
			src: string;
			durationSec?: number | null;
	  }
);

/**
 * A voice note before it is sent: the slim player with a round discard button
 * right next to it. Recording and review share this one row, so Stop turns
 * into Play in place and nothing jumps.
 */
export const VoiceNoteRow = forwardRef<HTMLDivElement, VoiceNoteRowProps>(
	(props, ref) => {
		const { t: translate } = useTranslation();
		const isReview = props.mode === 'review';
		const discardLabel = translate(
			isReview ? 'voice.recording.discard' : 'app.cancel'
		);

		return (
			<div
				ref={ref}
				className={['voiceNoteRow', props.className]
					.filter(Boolean)
					.join(' ')}
				{...(isReview
					? {
							'role': 'group',
							'tabIndex': -1,
							'aria-label': translate('voice.recording.preview')
						}
					: {})}
			>
				{props.mode === 'review' ? (
					<VoicePlayer
						src={props.src}
						durationSec={props.durationSec}
						showMeta={false}
						className="voicePlayer--composer"
					/>
				) : (
					<VoiceRecordingBar
						durationSec={props.durationSec}
						onStop={props.onStop}
						className="voicePlayer--composer"
					/>
				)}
				<button
					type="button"
					className="voiceNoteRow__discard"
					onClick={props.onDiscard}
					title={discardLabel}
					aria-label={discardLabel}
				>
					<CloseIcon fontSize="inherit" />
				</button>
			</div>
		);
	}
);

VoiceNoteRow.displayName = 'VoiceNoteRow';
