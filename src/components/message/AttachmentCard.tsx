import * as React from 'react';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import './attachmentCard.styles.scss';

/**
 * What the card does when it is activated (#994).
 *
 * - `download` renders an anchor, so the browser's own download affordances
 *   (context menu, middle click, "save link as") keep working.
 * - `unlock` renders a button, because decrypting is an action and not a
 *   navigation. It is also the state that must not look downloadable yet.
 * - `none` renders a plain container for blocked media, which by ADR-014 is
 *   neither rendered nor linked.
 */
export type AttachmentCardAction =
	| { kind: 'download'; href: string; fileName: string }
	| { kind: 'unlock'; onUnlock?: () => void; busy?: boolean }
	| { kind: 'none' };

export interface AttachmentCardProps {
	action: AttachmentCardAction;
	/** File-type icon; replaced by the state icon when the card is not downloadable. */
	icon?: React.ReactNode;
	fileName: string;
	/** Type and size, or the decryption/scan state. */
	meta: React.ReactNode;
	/** Image preview or blurred placeholder, rendered above the info row. */
	preview?: React.ReactNode;
	/** Accessible name for the whole card, e.g. "Download report.pdf". */
	actionLabel: string;
	blocked?: boolean;
	className?: string;
}

/**
 * One card for every attachment state (#994).
 *
 * Before this, each of the four states — plain, encrypted, awaiting media
 * check, blocked — built its own markup with its own inline styles, so the
 * same file looked different depending on encryption and scan state. The
 * visual definition now lives in `attachmentCard.styles.scss` on M3 tokens;
 * this component only decides which element carries the action.
 */
export const AttachmentCard = ({
	action,
	icon,
	fileName,
	meta,
	preview,
	actionLabel,
	blocked = false,
	className
}: AttachmentCardProps) => {
	const classNames = [
		'attachmentCard',
		blocked && 'attachmentCard--blocked',
		action.kind === 'unlock' && 'attachmentCard--locked',
		action.kind === 'none' && 'attachmentCard--inert',
		className
	]
		.filter(Boolean)
		.join(' ');

	const trailingIcon = blocked ? (
		<BlockRoundedIcon aria-hidden="true" focusable="false" />
	) : action.kind === 'download' ? (
		<DownloadRoundedIcon aria-hidden="true" focusable="false" />
	) : action.kind === 'unlock' ? (
		<LockRoundedIcon aria-hidden="true" focusable="false" />
	) : null;

	const body = (
		<>
			{preview}
			<span className="attachmentCard__info">
				{icon && <span className="attachmentCard__icon">{icon}</span>}
				<span className="attachmentCard__text">
					<span className="attachmentCard__filename" title={fileName}>
						{fileName}
					</span>
					<span className="attachmentCard__meta">{meta}</span>
				</span>
				{trailingIcon && (
					<span className="attachmentCard__action">
						{trailingIcon}
					</span>
				)}
			</span>
		</>
	);

	if (action.kind === 'download') {
		return (
			<a
				className={classNames}
				href={action.href}
				download={action.fileName}
				rel="noopener noreferrer"
				aria-label={actionLabel}
			>
				{body}
			</a>
		);
	}

	if (action.kind === 'unlock') {
		return (
			<button
				type="button"
				className={classNames}
				onClick={action.onUnlock}
				disabled={!action.onUnlock || action.busy}
				aria-label={actionLabel}
			>
				{body}
			</button>
		);
	}

	return (
		<div className={classNames} aria-label={actionLabel} role="group">
			{body}
		</div>
	);
};
