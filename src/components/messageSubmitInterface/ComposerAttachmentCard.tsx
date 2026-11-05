import * as React from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import GraphicEqRoundedIcon from '@mui/icons-material/GraphicEqRounded';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined';
import {
	ATTACHMENT_MAX_SIZE_IN_MB,
	formatAttachmentSize
} from './attachmentHelpers';
import {
	AttachmentFailureReason,
	canRetryAttachment
} from './attachmentSendFailure';
import './composerAttachmentCard.styles.scss';

/**
 * What the file is doing right now. `uploading` carries a percentage because
 * the upload reports real bytes (XMLHttpRequest progress of the encrypted
 * file). Encrypting and fetching a token before it, and the server's answer and
 * the message after it, have no such number, so they run without one: a bar
 * must never pretend.
 */
export type ComposerAttachmentStatus =
	| { kind: 'ready' }
	| { kind: 'preparing' }
	| { kind: 'uploading'; percent: number }
	| { kind: 'finishing' }
	| { kind: 'failed'; reason: AttachmentFailureReason };

export const deriveComposerAttachmentStatus = ({
	failure,
	isSending,
	progress
}: {
	failure?: AttachmentFailureReason | null;
	isSending: boolean;
	progress?: number | null;
}): ComposerAttachmentStatus => {
	if (failure) {
		return { kind: 'failed', reason: failure };
	}
	if (!isSending) {
		return { kind: 'ready' };
	}
	if (!progress) {
		return { kind: 'preparing' };
	}
	return progress >= 100
		? { kind: 'finishing' }
		: { kind: 'uploading', percent: progress };
};

const glyphForMimeType = (mimeType = '') => {
	if (mimeType.startsWith('image/')) return ImageOutlinedIcon;
	if (mimeType.startsWith('audio/')) return GraphicEqRoundedIcon;
	if (mimeType === 'application/pdf') return PictureAsPdfOutlinedIcon;
	if (mimeType.includes('spreadsheet')) return TableChartOutlinedIcon;
	if (mimeType.includes('word')) return DescriptionOutlinedIcon;
	return InsertDriveFileOutlinedIcon;
};

const fileTypeLabel = (fileName: string): string => {
	const extension = fileName.includes('.')
		? fileName.split('.').pop()
		: undefined;
	return extension ? extension.toUpperCase() : '';
};

export interface ComposerAttachmentCardProps {
	fileName: string;
	mimeType?: string;
	sizeBytes: number;
	/** Image thumbnail. Everything else shows the glyph for its type. */
	previewUrl?: string | null;
	status: ComposerAttachmentStatus;
	/** There is text in the composer, and it goes out with this file. */
	hasCaption?: boolean;
	onRemove?: () => void;
	onCancel?: () => void;
	onRetry?: () => void;
	onChooseAnother?: () => void;
	className?: string;
}

/**
 * The file waiting in the composer. It only shows states: the composer decides
 * them and owns the file, the draft and the upload.
 */
export const ComposerAttachmentCard = React.forwardRef<
	HTMLDivElement,
	ComposerAttachmentCardProps
>(function ComposerAttachmentCard(
	{
		fileName,
		mimeType,
		sizeBytes,
		previewUrl,
		status,
		hasCaption,
		onRemove,
		onCancel,
		onRetry,
		onChooseAnother,
		className
	},
	ref
) {
	const { t: translate, i18n } = useTranslation();
	const locale = i18n?.resolvedLanguage || i18n?.language;
	const failed = status.kind === 'failed';
	const failure = failed ? status.reason : null;
	const isRunning =
		status.kind === 'preparing' ||
		status.kind === 'uploading' ||
		status.kind === 'finishing';
	const canCancel =
		status.kind === 'preparing' || status.kind === 'uploading';
	const Glyph = failed ? ErrorOutlineRoundedIcon : glyphForMimeType(mimeType);
	const percent =
		status.kind === 'uploading' ? Math.round(status.percent) : null;
	const showThumb = Boolean(previewUrl) && !failed;
	const typeLabel = fileTypeLabel(fileName);
	const sizeLabel = formatAttachmentSize(sizeBytes, locale);

	return (
		<div
			ref={ref}
			role="group"
			aria-label={translate('attachments.composer.group', {
				name: fileName
			})}
			className={clsx(
				'composerAttachmentCard',
				failed && 'composerAttachmentCard--failed',
				className
			)}
		>
			<div className="composerAttachmentCard__main">
				{showThumb ? (
					<img
						className="composerAttachmentCard__thumb"
						src={previewUrl ?? undefined}
						alt=""
					/>
				) : (
					<span className="composerAttachmentCard__tile">
						<Glyph aria-hidden="true" focusable="false" />
					</span>
				)}
				<div className="composerAttachmentCard__text">
					<p
						className="composerAttachmentCard__name"
						title={fileName}
					>
						{fileName}
					</p>
					<p className="composerAttachmentCard__meta">
						{typeLabel ? `${typeLabel} · ${sizeLabel}` : sizeLabel}
					</p>
				</div>
				{canCancel && (
					<button
						type="button"
						className="composerAttachmentCard__textButton"
						onClick={onCancel}
					>
						{translate('attachments.composer.cancel')}
					</button>
				)}
				{(status.kind === 'ready' || failed) && (
					<button
						type="button"
						className="composerAttachmentCard__remove"
						onClick={onRemove}
						aria-label={translate('attachments.composer.remove', {
							name: fileName
						})}
					>
						<CloseRoundedIcon
							aria-hidden="true"
							focusable="false"
						/>
					</button>
				)}
			</div>

			{status.kind === 'ready' && hasCaption && (
				<p className="composerAttachmentCard__hint">
					{translate('attachments.composer.captionHint')}
				</p>
			)}

			{isRunning && (
				<div className="composerAttachmentCard__progress">
					<div className="composerAttachmentCard__progressLabel">
						{/* Announces the phase once, not every percent. */}
						<span role="status">
							{translate(
								status.kind === 'preparing'
									? 'attachments.composer.status.preparing'
									: status.kind === 'uploading'
										? 'attachments.composer.status.uploading'
										: 'attachments.composer.status.finishing'
							)}
						</span>
						{percent !== null && (
							<span aria-hidden="true">{percent} %</span>
						)}
					</div>
					<div
						className={clsx(
							'composerAttachmentCard__track',
							percent === null &&
								'composerAttachmentCard__track--indeterminate'
						)}
						role="progressbar"
						aria-label={translate(
							'attachments.composer.progressLabel',
							{ name: fileName }
						)}
						{...(percent !== null
							? {
									'aria-valuemin': 0,
									'aria-valuemax': 100,
									'aria-valuenow': percent
								}
							: {})}
					>
						<span
							className="composerAttachmentCard__bar"
							style={
								percent !== null
									? { width: `${percent}%` }
									: undefined
							}
						/>
					</div>
				</div>
			)}

			{failure && (
				<div className="composerAttachmentCard__failure">
					<p className="composerAttachmentCard__message" role="alert">
						{translate(
							`attachments.composer.error.${failure}`,
							failure === 'tooLarge'
								? {
										size: formatAttachmentSize(
											sizeBytes,
											locale,
											{ roundUp: true }
										),
										limit: ATTACHMENT_MAX_SIZE_IN_MB
									}
								: undefined
						)}
					</p>
					{canRetryAttachment(failure) ? (
						<button
							type="button"
							className="composerAttachmentCard__textButton"
							onClick={onRetry}
						>
							{translate('attachments.composer.retry')}
						</button>
					) : (
						<button
							type="button"
							className="composerAttachmentCard__textButton"
							onClick={onChooseAnother}
						>
							{translate('attachments.composer.chooseAnother')}
						</button>
					)}
				</div>
			)}
		</div>
	);
});
