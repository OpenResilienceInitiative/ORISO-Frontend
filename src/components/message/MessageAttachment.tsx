import * as React from 'react';
import {
	ATTACHMENT_TRANSLATE_FOR_TYPE,
	formatAttachmentSize
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
import {
	isVoiceMessageHeard,
	markVoiceMessageHeard
} from '../../utils/heardVoiceMessages';

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
	/** The sender knows their own recording, so it waits for Play. */
	isOwnMessage?: boolean;
}

const NOT_ENCRYPTED = 'not_encrypted';
const ENCRYPTED = 'encrypted';
const IS_DECRYPTING = 'is_decrypting';
const DECRYPTION_ERROR = 'decryption_error';
const DECRYPTION_FINISHED = 'decryption_finished';

export const MessageAttachment = (props: MessageAttachmentProps) => {
	const { t: translate, i18n } = useTranslation();
	const { addNotification } = React.useContext(NotificationsContext);
	const matrixEncryptedFile = props.attachment.encryptedFile;
	const isMatrixEncryptedAttachment = Boolean(matrixEncryptedFile);
	const isEncryptedAttachment =
		props.t === 'e2e' || isMatrixEncryptedAttachment;

	const [encryptedFile, setEncryptedFile] = React.useState(null);
	// The decrypted bytes stay in memory for as long as this URL lives.
	React.useEffect(
		() => () => {
			if (encryptedFile) {
				window.URL.revokeObjectURL(encryptedFile);
			}
		},
		[encryptedFile]
	);
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

		// Voice loads without being asked and says so in place, so a chat of
		// unavailable recordings must not stack one notification per message.
		const notifyFailure = () => {
			if (props.file.type?.startsWith('audio/')) {
				return;
			}
			addNotification({
				notificationType: NOTIFICATION_TYPE_ERROR,
				title: translate('e2ee.attachment.error.title'),
				text: translate('e2ee.attachment.error.text'),
				closeable: true,
				timeout: 60000
			});
		};

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
				notifyFailure();
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
				notifyFailure();

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

	// Prefer the canonical duration encoded in the file name so sender and
	// receiver show the same length; VoicePlayer falls back to the duration
	// reported by the audio element when the name carries none.
	const durationMsFromFileName = voiceDurationMsFromFileName(
		props.file?.name || props.attachment?.title || ''
	);
	const durationFromFileName =
		durationMsFromFileName === null ? null : durationMsFromFileName / 1000;

	// A long chat must not fetch and decrypt every old recording (#1140). The
	// player needs no bytes to stand there, so they follow when the message
	// comes into view and is still unheard, otherwise on Play. Without a length
	// in the file name it loads in view too, or the player would show 0:00.
	const voiceMediaUrl =
		matrixEncryptedFile?.url ??
		props.attachment.mxcUrl ??
		props.attachment.downloadUrl;
	const [isVoiceWanted, setIsVoiceWanted] = React.useState(false);
	const [isVoiceLoadFailed, setIsVoiceLoadFailed] = React.useState(false);
	// Read once: the list is parsed from storage and only matters before loading.
	const [wasVoiceHeard] = React.useState(
		() => Boolean(isAudio) && isVoiceMessageHeard(voiceMediaUrl)
	);
	const voicePlayerRef = React.useRef<HTMLDivElement>(null);
	const isVoiceWaiting = isAudio && !isVoiceWanted;
	const loadVoiceInView =
		durationFromFileName === null ||
		(!props.isOwnMessage && !wasVoiceHeard);

	React.useEffect(() => {
		const player = voicePlayerRef.current;
		if (
			!isVoiceWaiting ||
			!loadVoiceInView ||
			!player ||
			typeof IntersectionObserver === 'undefined'
		) {
			return;
		}
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) {
					setIsVoiceWanted(true);
				}
			},
			{ rootMargin: '200px' }
		);
		observer.observe(player);
		return () => observer.disconnect();
	}, [isVoiceWaiting, loadVoiceInView]);

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
			!isVoiceWaiting &&
			!isVoiceLoadFailed &&
			effectiveMediaState !== 'blocked' &&
			effectiveMediaState !== 'error'
			? props.attachment.mxcUrl
			: null,
		props.file.type,
		// Without this Play would keep saying it is loading.
		isAudio ? () => setIsVoiceLoadFailed(true) : undefined
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
	// deployed the existing unlock flow stays in place, except for voice, which
	// has no gate: its bytes come once they are wanted, scanner or not.
	React.useEffect(() => {
		if (
			((isMatrixEncryptedAttachment && isMediaContentScannerEnabled()) ||
				(isEncryptedAttachment && isAudio)) &&
			attachmentStatus === ENCRYPTED &&
			scanVerdict === null &&
			!isAwaitingReveal &&
			!isVoiceWaiting
		) {
			void decryptFile();
		}
	}, [
		attachmentStatus,
		decryptFile,
		isAudio,
		isAwaitingReveal,
		isEncryptedAttachment,
		isMatrixEncryptedAttachment,
		isVoiceWaiting,
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

	const sizeBytes = props.attachment.size;
	const locale = (i18n?.language || i18n?.resolvedLanguage)?.split('@')[0];
	const fileMeta = (
		<>
			{translate(ATTACHMENT_TRANSLATE_FOR_TYPE[props.file.type])}
			{typeof sizeBytes === 'number' &&
			sizeBytes > 0 &&
			Number.isFinite(sizeBytes)
				? ` | ${formatAttachmentSize(sizeBytes, locale)}`
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
	const gateActionLabel = translate(
		isMediaContentScannerEnabled()
			? 'attachments.gate.check'
			: 'attachments.gate.decrypt'
	);

	const renderVoiceAttachment = useCallback(
		(src?: string) => (
			<VoicePlayer
				src={src}
				containerRef={voicePlayerRef}
				onRequestSource={() => setIsVoiceWanted(true)}
				onPlayStart={() => markVoiceMessageHeard(voiceMediaUrl)}
				durationSec={durationFromFileName}
				// The surrounding message already draws the bubble; it also
				// sets --voicePlayer-tile-idle for own messages.
				bubble="none"
				fill
				showMeta={false}
			/>
		),
		[durationFromFileName, voiceMediaUrl]
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

	if (isVoiceLoadFailed) {
		return (
			<AttachmentGate
				mimeType={props.file.type}
				fileName={props.attachment.title}
				meta={fileMeta}
				status={{
					kind: 'error',
					label: translate('attachments.gate.loadFailed'),
					retryLabel: translate('attachments.gate.retry'),
					onRetry: () => setIsVoiceLoadFailed(false)
				}}
			/>
		);
	}

	if (isAudio && attachmentStatus !== DECRYPTION_ERROR) {
		return renderVoiceAttachment(
			(isEncryptedAttachment ? encryptedFile : downloadUrl) || undefined
		);
	}

	return (
		<>
			{!isEncryptedAttachment ? (
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
						!showImagePreview && getAttachmentIcon(props.file.type)
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
			) : // Encrypted file - clickable to decrypt/download
			encryptedFile && attachmentStatus === DECRYPTION_FINISHED ? (
				<AttachmentCard
					action={{
						kind: 'download',
						href: encryptedFile,
						fileName: props.file.name
					}}
					icon={
						!showImagePreview && getAttachmentIcon(props.file.type)
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
										actionLabel: gateActionLabel,
										// Starts with the visible label so voice
										// control can activate what it sees.
										ariaLabel: `${gateActionLabel}: ${props.attachment.title} — ${translate(
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
