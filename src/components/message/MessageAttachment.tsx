import * as React from 'react';
import {
	ATTACHMENT_TRANSLATE_FOR_TYPE,
	getAttachmentSizeMBForKB
} from '../messageSubmitInterface/attachmentHelpers';
import { useTranslation } from 'react-i18next';
import { apiUrl } from '../../resources/scripts/endpoints';
import { useCallback, useRef } from 'react';
import { FETCH_METHODS, fetchData } from '../../api';
import { decryptMatrixAttachment } from '../../utils/matrixEncryptedAttachment';
import {
	NotificationsContext,
	NOTIFICATION_TYPE_ERROR
} from '../../globalState';
import { LoadingSpinner } from '../loadingSpinner/LoadingSpinner';
import { apiPostError, ERROR_LEVEL_WARN } from '../../api/apiPostError';
import { getIconForAttachmentType } from './messageHelpers';

/**
 * Media check state of an attachment (WP-4, epic ORISO-Admin#366):
 * `unchecked` keeps images unloaded until explicitly revealed, `blocked`
 * never renders or links the file, and `safe` renders normally.
 */
export type MediaCheckState = 'unchecked' | 'safe' | 'blocked';

interface MessageAttachmentProps {
	attachment: MessageService.Schemas.AttachmentDTO;
	file: MessageService.Schemas.FileDTO;
	hasRenderedMessage: boolean;
	rid: string;
	t?: string;
	mediaCheckState?: MediaCheckState;
	/** featureMediaInlineDisplay* for the chat type: off = plain file card, no preview. */
	inlineDisplayEnabled?: boolean;
}

const NOT_ENCRYPTED = 'not_encrypted';
const ENCRYPTED = 'encrypted';
const IS_DECRYPTING = 'is_decrypting';
const DECRYPTION_ERROR = 'decryption_error';
const DECRYPTION_FINISHED = 'decryption_finished';

export const MessageAttachment = (props: MessageAttachmentProps) => {
	const { t: translate } = useTranslation();
	const { addNotification } = React.useContext(NotificationsContext);
	const matrixEncryptedFile = (props.attachment as any).matrix_encrypted_file;
	const isMatrixEncryptedAttachment = Boolean(matrixEncryptedFile);
	const isEncryptedAttachment =
		props.t === 'e2e' || isMatrixEncryptedAttachment;

	const [encryptedFile, setEncryptedFile] = React.useState(null);
	const [attachmentStatus, setAttachmentStatus] = React.useState(
		isEncryptedAttachment ? ENCRYPTED : NOT_ENCRYPTED
	);
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const [isAudioPlaying, setIsAudioPlaying] = React.useState(false);
	const [audioDurationSec, setAudioDurationSec] = React.useState<
		number | null
	>(null);
	const [audioCurrentTimeSec, setAudioCurrentTimeSec] = React.useState(0);

	const decryptFile = useCallback(
		async (url: string) => {
			if (
				attachmentStatus === IS_DECRYPTING ||
				attachmentStatus === DECRYPTION_ERROR
			)
				return;

			// Legacy Rocket.Chat attachment encryption is removed; those
			// attachments (old pre-migration data) cannot be decrypted.
			if (isEncryptedAttachment && !isMatrixEncryptedAttachment) {
				setAttachmentStatus(DECRYPTION_ERROR);
				return;
			}

			setAttachmentStatus(IS_DECRYPTING);

			const data = await fetchData({
				url: url,
				method: FETCH_METHODS.GET,
				responseHandling: [],
				headersData: {
					'Content-Type': ''
				}
			});

			const skipDecryption = !isMatrixEncryptedAttachment;
			let blobUrl;

			if (skipDecryption) {
				// not encrypted
				const blob = await data.blob();
				blobUrl = window.URL.createObjectURL(blob);
			} else if (isMatrixEncryptedAttachment) {
				const decryptedBuffer = await decryptMatrixAttachment(
					await data.arrayBuffer(),
					matrixEncryptedFile
				).catch((error) => {
					setAttachmentStatus(DECRYPTION_ERROR);

					addNotification({
						notificationType: NOTIFICATION_TYPE_ERROR,
						title: translate('e2ee.attachment.error.title'),
						text: translate('e2ee.attachment.error.text'),
						closeable: true,
						timeout: 60000
					});

					apiPostError({
						name: error.name,
						message: error.message,
						stack: error.stack,
						level: ERROR_LEVEL_WARN
					}).then();

					return null;
				});

				if (!decryptedBuffer) {
					return;
				}

				const blob = new Blob([decryptedBuffer], {
					type: props.file.type
				});
				blobUrl = window.URL.createObjectURL(blob);
			}

			setEncryptedFile(blobUrl);
			setAttachmentStatus(DECRYPTION_FINISHED);
		},
		[
			attachmentStatus,
			isEncryptedAttachment,
			isMatrixEncryptedAttachment,
			matrixEncryptedFile,
			props.file.type,
			addNotification,
			translate
		]
	);

	const getAttachmentIcon = useCallback((type: string) => {
		const Icon = getIconForAttachmentType(type);
		if (Icon) {
			return <Icon aria-hidden="true" focusable="false" />;
		}
		return null;
	}, []);

	// Helper to build URL - if title_link is already a full URL, use it as-is
	const buildUrl = useCallback((link: string) => {
		if (!link) return '';
		// If link already starts with http:// or https://, it's a full URL
		if (link.startsWith('http://') || link.startsWith('https://')) {
			return link;
		}
		// Self-contained sources (object URLs, inline data) must pass through.
		if (link.startsWith('blob:') || link.startsWith('data:')) {
			return link;
		}
		// Otherwise, prepend apiUrl
		return apiUrl + link;
	}, []);

	// Check if it's an image to display preview
	const isImage =
		props.file.type?.startsWith('image/') ||
		props.attachment.type === 'image';
	const isAudio = props.file.type?.startsWith('audio/');
	const imageUrl = isImage ? buildUrl(props.attachment.title_link) : null;

	const [revealed, setRevealed] = React.useState(false);
	const mediaCheckState = props.mediaCheckState ?? 'safe';
	const inlineDisplayEnabled = props.inlineDisplayEnabled ?? true;
	const effectiveMediaState: MediaCheckState =
		mediaCheckState === 'unchecked' && revealed ? 'safe' : mediaCheckState;
	const showImagePreview = isImage && inlineDisplayEnabled;
	const isAwaitingReveal =
		isImage && effectiveMediaState === 'unchecked' && !revealed;
	const attachmentDimensions = props.attachment as unknown as {
		image_w?: number;
		image_h?: number;
	};

	const revealUncheckedImage = () => {
		setRevealed(true);
		if (isEncryptedAttachment && attachmentStatus === ENCRYPTED) {
			void decryptFile(buildUrl(props.attachment.title_link));
		}
	};

	const renderImagePreview = (src: string) => (
		<div
			className="messageItem__message__attachment__preview"
			style={
				attachmentDimensions.image_w && attachmentDimensions.image_h
					? {
							aspectRatio: `${attachmentDimensions.image_w} / ${attachmentDimensions.image_h}`
						}
					: undefined
			}
		>
			<img src={src} alt={props.attachment.title} />
		</div>
	);

	// For non-encrypted files, wrap in download link
	const downloadUrl = buildUrl(props.attachment.title_link);

	const formatAudioDuration = useCallback((duration: number | null) => {
		if (
			duration == null ||
			Number.isNaN(duration) ||
			!Number.isFinite(duration) ||
			duration <= 0
		) {
			return '--:--';
		}
		const rounded = Math.round(duration);
		const minutes = Math.floor(rounded / 60);
		const seconds = rounded % 60;
		return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
	}, []);

	const getVoiceDurationFromFileName = useCallback((): number | null => {
		const name = props.file?.name || props.attachment?.title || '';
		const matchSec = name.match(/-s(\d+)-ms\d+\.(webm|ogg|mp3|wav)$/i);
		if (matchSec) {
			const valueSec = parseInt(matchSec[1], 10);
			if (!Number.isNaN(valueSec) && valueSec > 0) {
				return valueSec;
			}
		}
		const matchMs = name.match(/-ms(\d+)\.(webm|ogg|mp3|wav)$/i);
		if (matchMs) {
			const valueMs = parseInt(matchMs[1], 10);
			if (!Number.isNaN(valueMs) && valueMs > 0) {
				return valueMs / 1000;
			}
		}
		const match = name.match(/-d(\d+)\.(webm|ogg|mp3|wav)$/i);
		if (!match) {
			return null;
		}
		const value = parseInt(match[1], 10);
		return Number.isNaN(value) ? null : value;
	}, [props.file?.name, props.attachment?.title]);

	const durationFromFileName = getVoiceDurationFromFileName();
	const resolvedDurationSec = durationFromFileName ?? audioDurationSec;
	const playbackProgress =
		resolvedDurationSec && resolvedDurationSec > 0
			? Math.min(
					100,
					Math.max(
						0,
						(audioCurrentTimeSec / resolvedDurationSec) * 100
					)
				)
			: 0;

	const renderVoiceAttachment = useCallback(
		(src: string) => (
			<div className="messageItem__voiceNote">
				<button
					type="button"
					className="messageItem__voiceNote__play"
					onClick={(e) => {
						e.preventDefault();
						e.stopPropagation();
						if (!audioRef.current) {
							return;
						}
						if (audioRef.current.paused) {
							audioRef.current.play().catch(() => {
								// ignore autoplay/permission rejections
							});
						} else {
							audioRef.current.pause();
						}
					}}
				>
					{isAudioPlaying ? '||' : '▶'}
				</button>
				<div className="messageItem__voiceNote__wave">
					<div
						className="messageItem__voiceNote__wavePlayed"
						style={{ width: `${playbackProgress}%` }}
					/>
				</div>
				<span className="messageItem__voiceNote__time">
					{formatAudioDuration(resolvedDurationSec)}
				</span>
				<audio
					ref={audioRef}
					src={src}
					preload="metadata"
					onPlay={() => setIsAudioPlaying(true)}
					onPause={() => setIsAudioPlaying(false)}
					onEnded={() => {
						setIsAudioPlaying(false);
						setAudioCurrentTimeSec(0);
					}}
					onTimeUpdate={() => {
						setAudioCurrentTimeSec(
							audioRef.current?.currentTime || 0
						);
					}}
					onLoadedMetadata={() => {
						if (durationFromFileName != null) {
							// Keep sender/receiver display identical by preferring canonical filename duration.
							setAudioDurationSec(durationFromFileName);
						} else {
							const duration = audioRef.current?.duration ?? null;
							if (
								duration != null &&
								Number.isFinite(duration) &&
								duration > 0
							) {
								setAudioDurationSec(duration);
							} else {
								setAudioDurationSec(
									getVoiceDurationFromFileName()
								);
							}
						}
						setAudioCurrentTimeSec(0);
					}}
				/>
			</div>
		),
		[
			playbackProgress,
			resolvedDurationSec,
			durationFromFileName,
			formatAudioDuration,
			isAudioPlaying,
			getVoiceDurationFromFileName
		]
	);

	if (effectiveMediaState === 'blocked') {
		// Fail-closed: blocked media is neither rendered nor linked (ADR-014).
		return (
			<div className="messageItem__message__attachment messageItem__message__attachment--blocked">
				<div className="messageItem__message__attachment__info">
					<span className="messageItem__message__attachment__icon">
						{getAttachmentIcon(props.file.type)}
					</span>
					<span className="messageItem__message__attachment__title">
						<p className="messageItem__message__attachment__filename">
							{props.attachment.title}
						</p>
						<p className="messageItem__message__attachment__meta">
							{translate('attachments.mediaCheck.blocked')}
						</p>
					</span>
				</div>
			</div>
		);
	}

	if (isAwaitingReveal) {
		return (
			<div className="messageItem__message__attachment messageItem__message__attachment--unchecked">
				<div className="messageItem__message__attachment__preview messageItem__message__attachment__preview--blurred">
					<p>{translate('attachments.mediaCheck.unchecked')}</p>
					<button
						type="button"
						className="messageItem__message__attachment__reveal"
						onClick={revealUncheckedImage}
					>
						{translate('attachments.mediaCheck.reveal')}
					</button>
				</div>
			</div>
		);
	}

	return (
		<>
			{!isEncryptedAttachment ? (
				isAudio ? (
					renderVoiceAttachment(downloadUrl)
				) : (
					<a
						href={downloadUrl}
						download={props.file.name}
						rel="noopener noreferrer"
						className="messageItem__message__attachment"
						style={{
							textDecoration: 'none',
							color: 'inherit',
							cursor: 'pointer'
						}}
					>
						{/* Show image preview for image files */}
						{showImagePreview &&
							imageUrl &&
							renderImagePreview(imageUrl)}

						{/* File info BELOW image */}
						<div className="messageItem__message__attachment__info">
							<span className="messageItem__message__attachment__icon">
								{!showImagePreview &&
									getAttachmentIcon(props.file.type)}
							</span>
							<span className="messageItem__message__attachment__title">
								<p className="messageItem__message__attachment__filename">
									{props.attachment.title}
								</p>
								<p className="messageItem__message__attachment__meta">
									{translate(
										ATTACHMENT_TRANSLATE_FOR_TYPE[
											props.file.type
										]
									)}{' '}
									{props.attachment.image_size
										? `| ${
												(
													getAttachmentSizeMBForKB(
														props.attachment
															.image_size * 1000
													) / 1000
												).toFixed(2) +
												translate(
													'attachments.type.label.mb'
												)
											}`
										: null}
								</p>
							</span>
						</div>
					</a>
				)
			) : // Encrypted file - clickable to decrypt/download
			encryptedFile && attachmentStatus === DECRYPTION_FINISHED ? (
				isAudio ? (
					renderVoiceAttachment(encryptedFile)
				) : (
					<a
						href={encryptedFile}
						download={props.file.name}
						rel="noopener noreferrer"
						className="messageItem__message__attachment"
						style={{
							textDecoration: 'none',
							color: 'inherit',
							cursor: 'pointer'
						}}
					>
						{showImagePreview && renderImagePreview(encryptedFile)}

						<div className="messageItem__message__attachment__info">
							<span className="messageItem__message__attachment__icon">
								{!showImagePreview &&
									getAttachmentIcon(props.file.type)}
							</span>
							<span className="messageItem__message__attachment__title">
								<p className="messageItem__message__attachment__filename">
									{props.attachment.title}
								</p>
								<p className="messageItem__message__attachment__meta">
									{translate(
										ATTACHMENT_TRANSLATE_FOR_TYPE[
											props.file.type
										]
									)}{' '}
									{props.attachment.image_size
										? `| ${(
												getAttachmentSizeMBForKB(
													props.attachment
														.image_size * 1000
												) / 1000
											).toFixed(2)}${translate(
												'attachments.type.label.mb'
											)}`
										: null}
								</p>
							</span>
						</div>
					</a>
				)
			) : (
				<div
					className="messageItem__message__attachment"
					onClick={() =>
						attachmentStatus === ENCRYPTED &&
						decryptFile(buildUrl(props.attachment.title_link))
					}
					style={{
						cursor:
							attachmentStatus === ENCRYPTED
								? 'pointer'
								: 'default'
					}}
				>
					<div className="messageItem__message__attachment__info">
						<span className="messageItem__message__attachment__icon">
							{attachmentStatus === IS_DECRYPTING ? (
								<LoadingSpinner />
							) : (
								getAttachmentIcon(props.file.type)
							)}
						</span>
						<span className="messageItem__message__attachment__title">
							<p className="messageItem__message__attachment__filename">
								{props.attachment.title}
							</p>
							<p className="messageItem__message__attachment__meta">
								{translate(
									`e2ee.attachment.${attachmentStatus}`
								)}
							</p>
						</span>
					</div>
				</div>
			)}
		</>
	);
};
