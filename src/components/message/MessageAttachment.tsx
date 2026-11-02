import * as React from 'react';
import {
	ATTACHMENT_TRANSLATE_FOR_TYPE,
	getAttachmentSizeMBForKB
} from '../messageSubmitInterface/attachmentHelpers';
import { useTranslation } from 'react-i18next';
import { apiUrl } from '../../resources/scripts/endpoints';
import { useCallback } from 'react';
import { decryptMatrixAttachment } from '../../utils/matrixEncryptedAttachment';
import {
	fetchAuthenticatedMatrixMedia,
	useAuthenticatedMatrixMediaUrl
} from '../../utils/matrixAuthenticatedMedia';
import {
	downloadScannedEncryptedMedia,
	isMediaContentScannerEnabled,
	isMediaImageCheckEnabled
} from '../../services/mediaContentScanner';
import {
	NotificationsContext,
	NOTIFICATION_TYPE_ERROR
} from '../../globalState';
import { apiPostError, ERROR_LEVEL_WARN } from '../../api/apiPostError';
import { getIconForAttachmentType } from './messageHelpers';
import { AttachmentCard } from './AttachmentCard';
import { AttachmentGate, AttachmentGateStatus } from './AttachmentGate';
import { VoicePlayer } from '../voicePlayer/VoicePlayer';
import type { ChatAttachment, ChatFile } from './chatAttachmentTypes';
import { voiceDurationMsFromFileName } from '../../utils/voiceMessageFileName';

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
	const decryptFile = useCallback(async () => {
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

		// Authenticated media (#1487). This used to go through fetchData(),
		// which attaches the *Keycloak* access token from the `keycloak`
		// cookie (src/api/fetchData.ts) — a token Synapse has no reason to
		// accept. It only ever worked because the legacy endpoint ignored
		// authorization entirely. With E2EE permanently on this is the path
		// almost every attachment takes, so it was broken twice over: wrong
		// endpoint and wrong token. Both are fixed here, in one helper.
		const ciphertextUri = matrixEncryptedFile?.url;
		if (!ciphertextUri) {
			setAttachmentStatus(DECRYPTION_ERROR);
			return;
		}

		const data = await fetchAuthenticatedMatrixMedia(ciphertextUri).catch(
			(error) => {
				setAttachmentStatus(DECRYPTION_ERROR);
				addNotification({
					notificationType: NOTIFICATION_TYPE_ERROR,
					title: translate('e2ee.attachment.error.title'),
					text: translate('e2ee.attachment.error.text'),
					closeable: true,
					timeout: 60000
				});
				apiPostError({
					name: error?.name,
					message: error?.message,
					stack: error?.stack,
					level: ERROR_LEVEL_WARN
				}).then();
				return null;
			}
		);

		if (!data) {
			return;
		}

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
	}, [
		attachmentStatus,
		isEncryptedAttachment,
		isMatrixEncryptedAttachment,
		matrixEncryptedFile,
		props.file.type,
		addNotification,
		translate
	]);

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

	// Authenticated media (#1487): unencrypted homeserver media has no URL a
	// browser can use on its own — `<img src>`, `<a href>` and an audio source
	// cannot carry a bearer token. The bytes are fetched with the Matrix access
	// token and handed on as an object URL instead. `null` while the media must
	// not be requested at all: an unrevealed guest image, withheld media, or an
	// encrypted attachment (whose ciphertext goes through decryptFile).
	const needsAuthenticatedMedia =
		Boolean(props.attachment.mxcUrl) && !isEncryptedAttachment;
	const authenticatedMediaUrl = useAuthenticatedMatrixMediaUrl(
		needsAuthenticatedMedia &&
			!isAwaitingReveal &&
			effectiveMediaState !== 'blocked' &&
			effectiveMediaState !== 'error'
			? props.attachment.mxcUrl
			: null,
		props.file.type
	);
	// One resolved source for every plain consumer below: the image preview,
	// the download anchor and the voice player.
	const plainMediaUrl = needsAuthenticatedMedia
		? (authenticatedMediaUrl ?? '')
		: buildUrl(props.attachment.downloadUrl);
	const imageUrl = isImage ? plainMediaUrl : null;

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
			void decryptFile();
		}
	}, [
		attachmentStatus,
		decryptFile,
		isAwaitingReveal,
		isMatrixEncryptedAttachment,
		scanVerdict
	]);

	const revealUncheckedImage = () => {
		setRevealed(true);
		if (isEncryptedAttachment && attachmentStatus === ENCRYPTED) {
			void decryptFile();
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

	// Both run on the scanner, which answers once for the whole file. So they
	// are shown running side by side, never as a sequence the client cannot see.
	const scanStatus = (): AttachmentGateStatus => {
		if (!isMediaContentScannerEnabled()) {
			return {
				kind: 'working',
				label: translate('attachments.gate.decrypting')
			};
		}
		if (!isImage || !isMediaImageCheckEnabled()) {
			return {
				kind: 'working',
				label: translate('attachments.gate.checking')
			};
		}
		return {
			kind: 'working',
			label: translate('attachments.gate.checkingImage'),
			checks: [
				{
					label: translate('attachments.gate.checkVirus'),
					state: 'running'
				},
				{
					label: translate('attachments.gate.checkImage'),
					state: 'running'
				}
			]
		};
	};

	const gateAspectRatio =
		attachmentDimensions.width && attachmentDimensions.height
			? `${attachmentDimensions.width} / ${attachmentDimensions.height}`
			: undefined;

	// For non-encrypted files, wrap in download link
	const downloadUrl = plainMediaUrl;

	// Prefer the canonical duration encoded in the file name so sender and
	// receiver show the same length; VoicePlayer falls back to the duration
	// reported by the audio element when the name carries none.
	const durationMsFromFileName = voiceDurationMsFromFileName(
		props.file?.name || props.attachment?.title || ''
	);
	const durationFromFileName =
		durationMsFromFileName === null ? null : durationMsFromFileName / 1000;

	const renderVoiceAttachment = useCallback(
		(src: string) => (
			<VoicePlayer
				src={src}
				durationSec={durationFromFileName}
				// The surrounding message already draws the bubble; it also
				// sets --voicePlayer-tile-idle for own messages.
				bubble="none"
				fill
				showMeta={false}
			/>
		),
		[durationFromFileName]
	);

	if (effectiveMediaState === 'blocked' || effectiveMediaState === 'error') {
		// Fail-closed: withheld media is neither rendered nor linked (ADR-019).
		// `error` means nothing judged the file, so it is withheld just as
		// strictly — only the wording differs, because claiming a file was
		// rejected when no check ran would be untrue.
		return (
			<AttachmentGate
				mimeType={props.file.type}
				fileName={props.attachment.title}
				meta={fileMeta}
				status={
					effectiveMediaState === 'error'
						? {
								kind: 'error',
								label: translate(
									'attachments.mediaCheck.error'
								),
								retryLabel: translate('attachments.gate.retry'),
								// Only a verdict of our own can be asked for again.
								onRetry:
									scanVerdict === 'error'
										? () => setScanVerdict(null)
										: undefined
							}
						: {
								kind: 'blocked',
								label: translate(
									'attachments.mediaCheck.blocked'
								)
							}
				}
			/>
		);
	}

	if (isAwaitingReveal) {
		return (
			<AttachmentGate
				mimeType={props.file.type}
				fileName={props.attachment.title}
				meta={fileMeta}
				aspectRatio={gateAspectRatio}
				status={{
					kind: 'gate',
					actionLabel: translate('attachments.mediaCheck.reveal'),
					hint: translate('attachments.mediaCheck.unchecked'),
					onAction: revealUncheckedImage
				}}
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
						action={
							// Authenticated media (#1487): until the bytes have
							// been fetched there is no URL to link to, and an
							// empty href would navigate the page. The card stays
							// unlinked instead of pretending to be downloadable.
							downloadUrl
								? {
										kind: 'download',
										href: downloadUrl,
										fileName: props.file.name
									}
								: { kind: 'none' }
						}
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
				<AttachmentGate
					mimeType={props.file.type}
					fileName={props.attachment.title}
					meta={fileMeta}
					aspectRatio={gateAspectRatio}
					status={
						attachmentStatus === IS_DECRYPTING
							? scanStatus()
							: attachmentStatus === DECRYPTION_ERROR
								? {
										kind: 'error',
										label: translate(
											'e2ee.attachment.decryption_error'
										)
									}
								: {
										kind: 'gate',
										actionLabel: translate(
											isMediaContentScannerEnabled()
												? 'attachments.gate.check'
												: 'attachments.gate.decrypt'
										),
										ariaLabel: `${props.attachment.title} — ${translate(
											'e2ee.attachment.encrypted'
										)}`,
										hint: translate(
											'attachments.gate.encryptedHint'
										),
										onAction: () => decryptFile()
									}
					}
				/>
			)}
		</>
	);
};
