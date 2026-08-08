import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
	formatClock,
	getTileLayout,
	type VoicePlayerSize
} from './voicePlayerLayout';

import './voicePlayer.styles';

export type VoicePlayerVariant = 'tiles' | 'ring';
export type VoicePlayerBubble = 'incoming' | 'outgoing' | 'none';
export type { VoicePlayerSize };

export interface VoicePlayerProps {
	/** Audio source. Omit only for layout previews — playback needs it. */
	src?: string;
	/**
	 * Canonical duration in seconds. Prefer the value derived from the file
	 * name so sender and receiver show the same length; when it is unknown the
	 * player falls back to the duration reported by the audio element.
	 */
	durationSec?: number | null;
	/**
	 * `tiles` is the standard: everywhere the recording appears as a message.
	 * `ring` is for rows and references — conversation list, timeline,
	 * notification, reply quote, very narrow columns.
	 */
	variant?: VoicePlayerVariant;
	/**
	 * Whether the player draws its own bubble. Use `none` when it sits inside
	 * a bubble the surrounding message already draws.
	 */
	bubble?: VoicePlayerBubble;
	size?: VoicePlayerSize;
	/** Meta line under the tiles / the label column next to the ring. */
	showMeta?: boolean;
	/** Shown in the ring tooltip when no `note` is given. */
	sender?: string;
	/** Shown in the ring tooltip next to `sender`. */
	sentAt?: string;
	/** Extra note, e.g. "noch nicht angehört". Wins over sender/sentAt. */
	note?: string;
	/** Starting position as a fraction of the duration (0…1). */
	initialProgress?: number;
	className?: string;
}

const PlayIcon = ({ size }: { size: number }) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="currentColor"
		aria-hidden="true"
		focusable="false"
		className="voicePlayer__icon voicePlayer__icon--play"
	>
		<path d="M7 5l12 7-12 7z" />
	</svg>
);

const PauseIcon = ({ size }: { size: number }) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="currentColor"
		aria-hidden="true"
		focusable="false"
		className="voicePlayer__icon"
	>
		<rect x="6" y="5" width="4" height="14" rx="1.2" />
		<rect x="14" y="5" width="4" height="14" rx="1.2" />
	</svg>
);

export const VoicePlayer = ({
	src,
	durationSec,
	variant = 'tiles',
	bubble = 'incoming',
	size = 'md',
	showMeta = true,
	sender,
	sentAt,
	note,
	initialProgress = 0,
	className
}: VoicePlayerProps) => {
	const { t: translate } = useTranslation();
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const [isPlaying, setIsPlaying] = useState(false);
	const [positionSec, setPositionSec] = useState(0);
	const [metadataDurationSec, setMetadataDurationSec] = useState<
		number | null
	>(null);
	const [isTooltipOpen, setIsTooltipOpen] = useState(false);

	const duration =
		durationSec != null && durationSec > 0
			? durationSec
			: (metadataDurationSec ?? 0);
	const position = Math.min(positionSec, duration);
	const isOutgoing = bubble === 'outgoing';
	const isRing = variant === 'ring';

	const { count, secondsPerTile, isSectioned } = useMemo(
		() => getTileLayout(duration, size),
		[duration, size]
	);

	const seekTo = useCallback((seconds: number) => {
		setPositionSec(seconds);
		if (audioRef.current) {
			audioRef.current.currentTime = seconds;
		}
	}, []);

	// Apply the resume position once, as soon as a duration is known.
	const hasAppliedInitialProgress = useRef(false);
	useEffect(() => {
		if (
			hasAppliedInitialProgress.current ||
			!initialProgress ||
			duration <= 0
		) {
			return;
		}
		hasAppliedInitialProgress.current = true;
		seekTo(Math.min(1, Math.max(0, initialProgress)) * duration);
	}, [duration, initialProgress, seekTo]);

	const togglePlayback = useCallback(() => {
		const audio = audioRef.current;
		if (!audio) {
			return;
		}
		if (audio.paused) {
			if (duration > 0 && audio.currentTime >= duration - 0.05) {
				audio.currentTime = 0;
			}
			audio.play().catch(() => {
				// ignore autoplay/permission rejections
			});
		} else {
			audio.pause();
		}
	}, [duration]);

	const clock = `${formatClock(position)} / ${formatClock(duration)}`;
	const remaining =
		isPlaying || position > 0
			? translate('voicePlayer.remaining', {
					remaining: formatClock(duration - position),
					total: formatClock(duration)
				})
			: formatClock(duration);

	const metaParts = [
		isSectioned
			? translate('voicePlayer.meta.perTile', {
					total: formatClock(duration),
					seconds: Math.round(secondsPerTile)
				})
			: translate('voicePlayer.meta.perSecond', {
					seconds: Math.round(duration)
				})
	];
	if (note) {
		metaParts.push(note);
	}

	const tooltipBody =
		note ??
		(sender
			? [sender, sentAt].filter(Boolean).join(' · ')
			: translate('voicePlayer.encrypted'));

	const toggleLabel = isPlaying
		? translate('voicePlayer.pause')
		: translate('voicePlayer.play');

	const playButton = (
		<button
			type="button"
			className={`voicePlayer__toggle voicePlayer__toggle--${variant}`}
			onClick={(event) => {
				event.preventDefault();
				event.stopPropagation();
				togglePlayback();
			}}
			aria-label={
				isRing
					? translate('voicePlayer.aria', {
							duration: formatClock(duration)
						})
					: toggleLabel
			}
			{...(isRing
				? {
						style: {
							['--voice-player-ring-progress' as string]: `${
								duration > 0 ? (position / duration) * 360 : 0
							}deg`
						},
						onMouseEnter: () => setIsTooltipOpen(true),
						onMouseLeave: () => setIsTooltipOpen(false),
						onFocus: () => setIsTooltipOpen(true),
						onBlur: () => setIsTooltipOpen(false)
					}
				: {})}
		>
			{isRing ? (
				<span className="voicePlayer__knob">
					{isPlaying ? (
						<PauseIcon size={13} />
					) : (
						<PlayIcon size={13} />
					)}
				</span>
			) : isPlaying ? (
				<PauseIcon size={14} />
			) : (
				<PlayIcon size={14} />
			)}
		</button>
	);

	return (
		<div
			className={[
				'voicePlayer',
				`voicePlayer--${variant}`,
				`voicePlayer--${size}`,
				`voicePlayer--bubble-${bubble}`,
				isOutgoing ? 'voicePlayer--outgoing' : null,
				className
			]
				.filter(Boolean)
				.join(' ')}
		>
			{isRing ? (
				<div className="voicePlayer__row">
					<span className="voicePlayer__ringWrapper">
						{playButton}
						{isTooltipOpen && (
							<span
								className="voicePlayer__tooltip"
								role="tooltip"
							>
								<span className="voicePlayer__tooltipTitle">
									{`${translate('voicePlayer.label')} · ${formatClock(duration)}`}
								</span>
								<span className="voicePlayer__tooltipBody">
									{tooltipBody}
								</span>
							</span>
						)}
					</span>
					{showMeta && (
						<span className="voicePlayer__ringMeta">
							<span className="voicePlayer__ringLabel">
								{translate('voicePlayer.label')}
							</span>
							<span className="voicePlayer__ringRemaining">
								{remaining}
							</span>
						</span>
					)}
				</div>
			) : (
				<>
					<div className="voicePlayer__row">
						{playButton}
						<div
							className="voicePlayer__tiles"
							role="group"
							aria-label={translate('voicePlayer.timeline')}
						>
							{Array.from({ length: count }, (_, index) => {
								const tileStart = index * secondsPerTile;
								const isPlayed = tileStart < position;
								return (
									<button
										key={index}
										type="button"
										className={`voicePlayer__tile${
											isPlayed
												? ' voicePlayer__tile--played'
												: ''
										}`}
										aria-label={translate(
											'voicePlayer.jumpTo',
											{ time: formatClock(tileStart) }
										)}
										onClick={(event) => {
											event.preventDefault();
											event.stopPropagation();
											seekTo(tileStart);
										}}
									/>
								);
							})}
						</div>
						<span className="voicePlayer__clock">{clock}</span>
					</div>
					{showMeta && (
						<span className="voicePlayer__meta">
							{metaParts.join(' · ')}
						</span>
					)}
				</>
			)}

			<audio
				ref={audioRef}
				src={src}
				preload="metadata"
				className="voicePlayer__audio"
				onPlay={() => setIsPlaying(true)}
				onPause={() => setIsPlaying(false)}
				onEnded={() => {
					setIsPlaying(false);
					setPositionSec(duration);
				}}
				onTimeUpdate={() =>
					setPositionSec(audioRef.current?.currentTime ?? 0)
				}
				onLoadedMetadata={() => {
					const reported = audioRef.current?.duration ?? null;
					setMetadataDurationSec(
						reported != null &&
							Number.isFinite(reported) &&
							reported > 0
							? reported
							: null
					);
				}}
			/>
		</div>
	);
};
