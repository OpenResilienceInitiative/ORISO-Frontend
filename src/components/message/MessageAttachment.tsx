import * as React from 'react';
import {
	ATTACHMENT_TRANSLATE_FOR_TYPE,
	getAttachmentSizeMBForKB
} from '../messageSubmitInterface/attachmentHelpers';
import { useTranslation } from 'react-i18next';
import { apiUrl } from '../../resources/scripts/endpoints';
import { useCallback } from 'react';
import { FETCH_METHODS, fetchData } from '../../api';
import { decryptMatrixAttachment } from '../../utils/matrixEncryptedAttachment';
import {
	downloadScannedEncryptedMedia,
	isMediaContentScannerEnabled
} from '../../services/mediaContentScanner';
import {
	NotificationsContext,
	NOTIFICATION_TYPE_ERROR
} from '../../globalState';
import { LoadingSpinner } from '../loadingSpinner/LoadingSpinner';
import { apiPostError, ERROR_LEVEL_WARN } from '../../api/apiPostError';
import { getIconForAttachmentType } from './messageHelpers';
import { AttachmentCard } from './AttachmentCard';
import { VoicePlayer } from '../voicePlayer/VoicePlayer';
import type { ChatAttachment, ChatFile } from './chatAttachmentTypes';

/**
 * Media check state of an attachment (WP-4, epic ORISO-Admin#366):
 * `unchecked` keeps images unloaded until explicitly revealed, `blocked`
 * never renders or links the file, and `safe` renders normally.
 *
 * `error` is the fail-closed outcome added with the content scanner
 * (ADR-019, #1072): the file was not judged at all — scanner unreachable,
 * timed out, or answered something we cannot read. It is withheld exactly as
 * strictly as `blocked`, and only worded differently, because telling someone
 * their file was rejected when in truth nothing checked it is a lie.
 */
export type MediaCheckState = 'unchecked' | 'safe' | 'blocked' | 'error';

interface MessageAttachmentProps {
	attachment: ChatAttachment;
	file: ChatFile;
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
	const matrixEncryptedFile = props.attachment.encryptedFile;
	const isMatrixEncryptedAttachment = Boolean(matrixEncryptedFile);
	const isEncryptedAttachment =
		props.t === 'e2e' || isMatrixEncryptedAttachment;

	const [encryptedFile, setEncryptedFile] = React.useState(null);
	const [attachmentStatus, setAttachmentStatus] = React.useState(
		isEncryptedAttachment ? ENCRYPTED : NOT_ENCRYPTED
	);
	/** Verdict from the content scanner; `null` until one has been asked for. */
	const [scanVerdict, setScanVerdict] = React.useState<
		'blocked' | 'error' | null
	>(null);
	const decryptFile = useCallback(
		async (url: string) => {
			if (
				attachmentStatus === IS_DECRYPTING ||
				attachmentStatus === DECRYPTION_ERROR
			)
				return;

			// Attachments are encrypted by Matrix media handling; those
			// attachments (old pre-migration data) cannot be decrypted.
			if (isEncryptedAttachment && !isMatrixEncryptedAttachment) {
				setAttachmentStatus(DECRYPTION_ERROR);
				return;
			}

			setAttachmentStatus(IS_DECRYPTING);

			// With a content scanner deployed (ADR-019), an encrypted file is
			// never fetched and decrypted here. The client seals the file keys
			// to the scanner, which fetches, decrypts and scans it, and only
			// then hands back the plaintext. That is what makes the block
			// server-side: without a verdict there are simply no bytes.
			if (isMatrixEncryptedAttachment && isMediaContentScannerEnabled()) {
				const outcome =
					await downloadScannedEncryptedMedia(matrixEncryptedFile);

				if (outcome.verdict !== 'safe') {
					setScanVerdict(outcome.verdict);
					setAttachmentStatus(ENCRYPTED);
					return;
				}

				const scannedBlob = new Blob([outcome.data], {
					type: props.file.type
				});
				setEncryptedFile(window.URL.createObjectURL(scannedBlob));
				setAttachmentStatus(DECRYPTION_FINISHED);
				return;
			}

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

	// Helper to build URL - if downloadUrl is already a full URL, use it as-is
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
	const imageUrl = isImage ? buildUrl(props.attachment.downloadUrl) : null;

	const [revealed, setRevealed] = React.useState(false);
	const mediaCheckState = props.mediaCheckState ?? 'safe';
	const inlineDisplayEnabled = props.inlineDisplayEnabled ?? true;
	const revealedMediaState: MediaCheckState =
		mediaCheckState === 'unchecked' && revealed ? 'safe' : mediaCheckState;
	// A scanner verdict outranks anything the event metadata claimed: it is the
	// only judgement made on the actual bytes.
	const effectiveMediaState: MediaCheckState =
		scanVerdict ?? revealedMediaState;
	const showImagePreview = isImage && inlineDisplayEnabled;
	const isAwaitingReveal =
		isImage && effectiveMediaState === 'unchecked' && !revealed;
	const attachmentDimensions = props.attachment;

	// An encrypted attachment cannot be shown before the scanner has judged it,
	// so the verdict is fetched as soon as the attachment renders rather than
	// behind a click. Not while an image is still waiting to be revealed — that
	// gate exists precisely so nothing is fetched yet. Without a scanner
	// deployed this does nothing and the existing unlock flow stays in place.
	React.useEffect(() => {
		if (
			isMatrixEncryptedAttachment &&
			isMediaContentScannerEnabled() &&
			attachmentStatus === ENCRYPTED &&
			scanVerdict === null &&
			!isAwaitingReveal
		) {
			void decryptFile(buildUrl(props.attachment.downloadUrl));
		}
	}, [
		attachmentStatus,
		buildUrl,
		decryptFile,
		isAwaitingReveal,
		isMatrixEncryptedAttachment,
		props.attachment.downloadUrl,
		scanVerdict
	]);

	const revealUncheckedImage = () => {
		setRevealed(true);
		if (isEncryptedAttachment && attachmentStatus === ENCRYPTED) {
			void decryptFile(buildUrl(props.attachment.downloadUrl));
		}
	};

	const renderImagePreview = (src: string) => (
		<span
			className="attachmentCard__preview"
			style={
				attachmentDimensions.width && attachmentDimensions.height
					? {
							aspectRatio: `${attachmentDimensions.width} / ${attachmentDimensions.height}`
						}
					: undefined
			}
		>
			<img src={src} alt={props.attachment.title} />
		</span>
	);

	/** Type and size line, e.g. "PDF | 1.20 MB". */
	const fileMeta = (
		<>
			{translate(ATTACHMENT_TRANSLATE_FOR_TYPE[props.file.type])}
			{props.attachment.size
				? ` | ${(
						getAttachmentSizeMBForKB(props.attachment.size * 1000) /
						1000
					).toFixed(2)}${translate('attachments.type.label.mb')}`
				: null}
		</>
	);

	// For non-encrypted files, wrap in download link
	const downloadUrl = buildUrl(props.attachment.downloadUrl);

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

	// Prefer the canonical duration encoded in the file name so sender and
	// receiver show the same length; VoicePlayer falls back to the duration
	// reported by the audio element when the name carries none.
	const durationFromFileName = getVoiceDurationFromFileName();

	const renderVoiceAttachment = useCallback(
		(src: string) => (
			<VoicePlayer
				src={src}
				durationSec={durationFromFileName}
				// The surrounding message already draws the bubble; it also
				// sets --voicePlayer-tile-idle for own messages.
				bubble="none"
			/>
		),
		[durationFromFileName]
	);

	if (effectiveMediaState === 'blocked' || effectiveMediaState === 'error') {
		// Fail-closed: withheld media is neither rendered nor linked (ADR-019).
		// `error` means nothing judged the file, so it is withheld just as
		// strictly — only the wording differs, because claiming a file was
		// rejected when no check ran would be untrue.
		const metaKey =
			effectiveMediaState === 'error'
				? 'attachments.mediaCheck.error'
				: 'attachments.mediaCheck.blocked';
		return (
			<AttachmentCard
				action={{ kind: 'none' }}
				blocked
				icon={getAttachmentIcon(props.file.type)}
				fileName={props.attachment.title}
				meta={translate(metaKey)}
				actionLabel={`${props.attachment.title} — ${translate(metaKey)}`}
			/>
		);
	}

	if (isAwaitingReveal) {
		return (
			<AttachmentCard
				action={{ kind: 'none' }}
				fileName={props.attachment.title}
				meta={translate('attachments.mediaCheck.unchecked')}
				actionLabel={`${props.attachment.title} — ${translate(
					'attachments.mediaCheck.unchecked'
				)}`}
				preview={
					<span className="attachmentCard__preview attachmentCard__preview--blurred">
						<button
							type="button"
							className="attachmentCard__reveal"
							onClick={revealUncheckedImage}
						>
							{translate('attachments.mediaCheck.reveal')}
						</button>
					</span>
				}
			/>
		);
	}

	return (
		<>
			{!isEncryptedAttachment ? (
				isAudio ? (
					renderVoiceAttachment(downloadUrl)
				) : (
					<AttachmentCard
						action={{
							kind: 'download',
							href: downloadUrl,
							fileName: props.file.name
						}}
						icon={
							!showImagePreview &&
							getAttachmentIcon(props.file.type)
						}
						fileName={props.attachment.title}
						meta={fileMeta}
						actionLabel={translate('attachments.download.aria', {
							name: props.attachment.title
						})}
						preview={
							showImagePreview && imageUrl
								? renderImagePreview(imageUrl)
								: undefined
						}
					/>
				)
			) : // Encrypted file - clickable to decrypt/download
			encryptedFile && attachmentStatus === DECRYPTION_FINISHED ? (
				isAudio ? (
					renderVoiceAttachment(encryptedFile)
				) : (
					<AttachmentCard
						action={{
							kind: 'download',
							href: encryptedFile,
							fileName: props.file.name
						}}
						icon={
							!showImagePreview &&
							getAttachmentIcon(props.file.type)
						}
						fileName={props.attachment.title}
						meta={fileMeta}
						actionLabel={translate('attachments.download.aria', {
							name: props.attachment.title
						})}
						preview={
							showImagePreview
								? renderImagePreview(encryptedFile)
								: undefined
						}
					/>
				)
			) : (
				<AttachmentCard
					action={{
						kind: 'unlock',
						onUnlock:
							attachmentStatus === ENCRYPTED
								? () =>
										decryptFile(
											buildUrl(
												props.attachment.downloadUrl
											)
										)
								: undefined,
						busy: attachmentStatus === IS_DECRYPTING
					}}
					icon={
						attachmentStatus === IS_DECRYPTING ? (
							<LoadingSpinner />
						) : (
							getAttachmentIcon(props.file.type)
						)
					}
					fileName={props.attachment.title}
					meta={translate(`e2ee.attachment.${attachmentStatus}`)}
					actionLabel={`${props.attachment.title} — ${translate(
						`e2ee.attachment.${attachmentStatus}`
					)}`}
				/>
			)}
		</>
	);
};
