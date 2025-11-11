import * as React from 'react';
import {
	ATTACHMENT_TRANSLATE_FOR_TYPE,
	getAttachmentSizeMBForKB
} from '../messageSubmitInterface/attachmentHelpers';
import { ReactComponent as DownloadIcon } from '../../resources/img/icons/download.svg';
import { useTranslation } from 'react-i18next';
import { apiUrl } from '../../resources/scripts/endpoints';
import { useCallback } from 'react';
import { FETCH_METHODS, fetchData } from '../../api';
import { getValueFromCookie } from '../sessionCookie/accessSessionCookie';
import { generateCsrfToken } from '../../utils/generateCsrfToken';
import {
	decryptAttachment,
	ENCRYPTION_VERSION_ACTIVE,
	KEY_ID_LENGTH,
	MAX_PREFIX_LENGTH,
	VECTOR_LENGTH,
	VERSION_SEPERATOR
} from '../../utils/encryptionHelpers';
import { useE2EE } from '../../hooks/useE2EE';
import {
	STORAGE_KEY_ATTACHMENT_ENCRYPTION,
	useDevToolbar
} from '../devToolbar/DevToolbar';
import {
	NotificationsContext,
	NOTIFICATION_TYPE_ERROR
} from '../../globalState';
import { LoadingSpinner } from '../loadingSpinner/LoadingSpinner';
import { apiPostError, ERROR_LEVEL_WARN } from '../../api/apiPostError';
import clsx from 'clsx';
import { getIconForAttachmentType } from './messageHelpers';

interface MessageAttachmentProps {
	attachment: MessageService.Schemas.AttachmentDTO;
	file: MessageService.Schemas.FileDTO;
	hasRenderedMessage: boolean;
	rid: string;
	t?: string;
}

const NOT_ENCRYPTED = 'not_encrypted';
const ENCRYPTED = 'encrypted';
const IS_DECRYPTING = 'is_decrypting';
const DECRYPTION_ERROR = 'decryption_error';
const DECRYPTION_FINISHED = 'decryption_finished';

export const MessageAttachment = (props: MessageAttachmentProps) => {
	const { t: translate } = useTranslation();
	const { key, keyID, encrypted } = useE2EE(props.rid);
	const { getDevToolbarOption } = useDevToolbar();
	const { addNotification } = React.useContext(NotificationsContext);

	const [encryptedFile, setEncryptedFile] = React.useState(null);
	const [attachmentStatus, setAttachmentStatus] = React.useState(
		props.t === 'e2e' ? ENCRYPTED : NOT_ENCRYPTED
	);

	const decryptFile = useCallback(
		async (url: string) => {
			if (
				attachmentStatus === IS_DECRYPTING ||
				attachmentStatus === DECRYPTION_ERROR
			)
				return;
			const isAttachmentEncryptionEnabledDevTools = parseInt(
				getDevToolbarOption(STORAGE_KEY_ATTACHMENT_ENCRYPTION)
			);
			setAttachmentStatus(IS_DECRYPTING);

			const data = await fetchData({
				url: url,
				method: FETCH_METHODS.GET,
				responseHandling: [],
				headersData: {
					'Content-Type': ''
				}
			});

			const shouldDecrypt =
				encrypted &&
				props.t === 'e2e' &&
				isAttachmentEncryptionEnabledDevTools;
			const skipDecryption = !shouldDecrypt;
			let blobUrl;

			if (skipDecryption) {
				// not encrypted
				const blob = await data.blob();
				blobUrl = window.URL.createObjectURL(blob);
			} else {
				// encrypted
				const text = await data.text();
				const encryptedData = await decryptAttachment(
					text,
					props.attachment.title,
					keyID,
					key
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

				if (!encryptedData) {
					return;
				}

				const blobData = new Blob([encryptedData], {
					type: props.file.type
				});
				blobUrl = window.URL.createObjectURL(blobData);
			}

			setEncryptedFile(blobUrl);
			setAttachmentStatus(DECRYPTION_FINISHED);
		},
		[
			attachmentStatus,
			encrypted,
			key,
			keyID,
			props.attachment.title,
			props.t,
			props.file.type,
			getDevToolbarOption,
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
		// Otherwise, prepend apiUrl
		return apiUrl + link;
	}, []);

	// Check if it's an image to display preview
	const isImage = props.file.type?.startsWith('image/') || props.attachment.type === 'image';
	const imageUrl = isImage ? buildUrl(props.attachment.title_link) : null;

	// For non-encrypted files, wrap in download link
	const downloadUrl = buildUrl(props.attachment.title_link);
	
	return (
		<>
			{props.t !== 'e2e' ? (
				<a
					href={downloadUrl}
					download={props.file.name}
					rel="noopener noreferrer"
					className="messageItem__message__attachment"
					style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}
				>
					{/* Show image preview for image files */}
					{isImage && imageUrl && (
						<div className="messageItem__message__attachment__preview">
							<img 
								src={imageUrl} 
								alt={props.attachment.title}
							/>
						</div>
					)}
					
					{/* File info BELOW image */}
					<div className="messageItem__message__attachment__info">
						<span className="messageItem__message__attachment__icon">
							{!isImage && getAttachmentIcon(props.file.type)}
						</span>
						<span className="messageItem__message__attachment__title">
							<p className="messageItem__message__attachment__filename">{props.attachment.title}</p>
							<p className="messageItem__message__attachment__meta">
								{translate(
									ATTACHMENT_TRANSLATE_FOR_TYPE[props.file.type]
								)}{' '}
								{props.attachment.image_size
									? `| ${
											(
												getAttachmentSizeMBForKB(
													props.attachment.image_size * 1000
												) / 1000
											).toFixed(2) +
											translate('attachments.type.label.mb')
										}`
									: null}
							</p>
						</span>
					</div>
				</a>
			) : (
				// Encrypted file - clickable to decrypt/download
				encryptedFile && attachmentStatus === DECRYPTION_FINISHED ? (
					<a
						href={encryptedFile}
						download={props.file.name}
						rel="noopener noreferrer"
						className="messageItem__message__attachment"
						style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}
					>
						{isImage && (
							<div className="messageItem__message__attachment__preview">
								<img src={encryptedFile} alt={props.attachment.title} />
							</div>
						)}
						
						<div className="messageItem__message__attachment__info">
							<span className="messageItem__message__attachment__icon">
								{!isImage && getAttachmentIcon(props.file.type)}
							</span>
							<span className="messageItem__message__attachment__title">
								<p className="messageItem__message__attachment__filename">{props.attachment.title}</p>
								<p className="messageItem__message__attachment__meta">
									{translate(ATTACHMENT_TRANSLATE_FOR_TYPE[props.file.type])}{' '}
									{props.attachment.image_size
										? `| ${
												(
													getAttachmentSizeMBForKB(
														Math.floor(
															(props.attachment.image_size -
																KEY_ID_LENGTH -
																MAX_PREFIX_LENGTH -
																VERSION_SEPERATOR.length -
																ENCRYPTION_VERSION_ACTIVE.length -
																100) /
																2 -
																VECTOR_LENGTH * 2
														) * 1000
													) / 1000
												).toFixed(2) + translate('attachments.type.label.mb')
											}`
										: null}
								</p>
							</span>
						</div>
					</a>
				) : (
					<div 
						className="messageItem__message__attachment"
						onClick={() => attachmentStatus === ENCRYPTED && decryptFile(buildUrl(props.attachment.title_link))}
						style={{ cursor: attachmentStatus === ENCRYPTED ? 'pointer' : 'default' }}
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
								<p className="messageItem__message__attachment__filename">{props.attachment.title}</p>
								<p className="messageItem__message__attachment__meta">
									{translate(`e2ee.attachment.${attachmentStatus}`)}
								</p>
							</span>
						</div>
					</div>
				)
			)}
		</>
	);
};
