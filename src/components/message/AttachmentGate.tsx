import * as React from 'react';
import clsx from 'clsx';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import GppBadOutlinedIcon from '@mui/icons-material/GppBadOutlined';
import GraphicEqRoundedIcon from '@mui/icons-material/GraphicEqRounded';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import MovieOutlinedIcon from '@mui/icons-material/MovieOutlined';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined';
import './attachmentGate.styles.scss';

/**
 * One thing the check looks at. The caller words `label` for its state, so the
 * state never depends on the mark alone. `done` only on a real signal: a tick
 * here reads as "this part is safe".
 */
export interface AttachmentGateCheck {
	label: string;
	state: 'pending' | 'running' | 'done';
}

export type AttachmentGateStatus =
	/** Nothing is fetched yet. The person decides. */
	| {
			kind: 'gate';
			actionLabel: string;
			onAction?: () => void;
			/** Accessible name when the visible label alone says too little. */
			ariaLabel?: string;
			hint?: string;
	  }
	/**
	 * Running. `progress` (0 to 1) only when the real value is known, such as
	 * bytes uploaded. A virus check or a decryption has none, and a bar must
	 * never pretend it does, so those run without it.
	 */
	| {
			kind: 'working';
			label: string;
			progress?: number;
			/** What is being looked at, when it is more than one thing. */
			checks?: AttachmentGateCheck[];
	  }
	/** The check rejected the file. It is neither rendered nor linked. */
	| { kind: 'blocked'; label: string }
	/** Nothing judged the file, so it stays locked. May be tried again. */
	| {
			kind: 'error';
			label: string;
			retryLabel?: string;
			onRetry?: () => void;
	  };

export interface AttachmentGateProps {
	/** MIME type. Picks the glyph and the layout: visual media get a poster. */
	mimeType?: string;
	fileName: string;
	/** Type and size, such as "PNG · 1,20 MB". */
	meta?: React.ReactNode;
	status: AttachmentGateStatus;
	/** Reserves the final shape of an image, so nothing jumps once it is shown. */
	aspectRatio?: string;
	className?: string;
}

const glyphForMimeType = (mimeType = '') => {
	if (mimeType.startsWith('image/')) return ImageOutlinedIcon;
	if (mimeType.startsWith('video/')) return MovieOutlinedIcon;
	if (mimeType.startsWith('audio/')) return GraphicEqRoundedIcon;
	if (mimeType === 'application/pdf') return PictureAsPdfOutlinedIcon;
	if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
		return TableChartOutlinedIcon;
	}
	if (mimeType.includes('word') || mimeType.startsWith('text/')) {
		return DescriptionOutlinedIcon;
	}
	return InsertDriveFileOutlinedIcon;
};

const hasPoster = (mimeType = '') =>
	mimeType.startsWith('image/') || mimeType.startsWith('video/');

/**
 * The placeholder for a file that is not on this device yet. It stands in for
 * the file in the chat: every media type gets the same gate, the same running
 * state and the same refusal, images and videos as a poster that already has
 * the final shape, everything else as a compact row.
 *
 * It only shows states. Whether the file is fetched, checked or decrypted
 * stays with `MessageAttachment`.
 */
export const AttachmentGate = ({
	mimeType,
	fileName,
	meta,
	status,
	aspectRatio,
	className
}: AttachmentGateProps) => {
	const poster = hasPoster(mimeType);
	const refused = status.kind === 'blocked' || status.kind === 'error';
	const Glyph =
		status.kind === 'blocked'
			? GppBadOutlinedIcon
			: status.kind === 'error'
				? ErrorOutlineRoundedIcon
				: status.kind === 'working'
					? ShieldOutlinedIcon
					: glyphForMimeType(mimeType);

	const action =
		status.kind === 'gate' ? (
			<button
				type="button"
				className="attachmentGate__button"
				onClick={status.onAction}
				disabled={!status.onAction}
				aria-label={status.ariaLabel}
			>
				<ShieldOutlinedIcon aria-hidden="true" />
				{status.actionLabel}
			</button>
		) : status.kind === 'error' && status.onRetry && status.retryLabel ? (
			<button
				type="button"
				className="attachmentGate__button attachmentGate__button--quiet"
				onClick={status.onRetry}
			>
				{status.retryLabel}
			</button>
		) : null;

	const note =
		status.kind === 'gate'
			? status.hint
			: status.kind === 'working'
				? null
				: status.label;

	const progress =
		status.kind === 'working' ? (
			<>
				<div className="attachmentGate__working" role="status">
					{status.label}
					{status.progress !== undefined &&
						` ${Math.round(status.progress * 100)} %`}
				</div>
				{status.checks && (
					<ul className="attachmentGate__checks">
						{status.checks.map((check) => (
							<li
								key={check.label}
								className={`attachmentGate__check attachmentGate__check--${check.state}`}
							>
								<span
									className="attachmentGate__checkMark"
									aria-hidden="true"
								>
									{check.state === 'done' && (
										<CheckRoundedIcon />
									)}
								</span>
								{check.label}
							</li>
						))}
					</ul>
				)}
				<div
					className={clsx(
						'attachmentGate__bar',
						status.progress === undefined &&
							'attachmentGate__bar--running'
					)}
					role="progressbar"
					aria-label={status.label}
					{...(status.progress !== undefined && {
						'aria-valuemin': 0,
						'aria-valuemax': 100,
						'aria-valuenow': Math.round(status.progress * 100)
					})}
				>
					<div
						className="attachmentGate__barFill"
						style={
							status.progress !== undefined
								? { width: `${status.progress * 100}%` }
								: undefined
						}
					/>
				</div>
			</>
		) : null;

	const info = (
		<div className="attachmentGate__text">
			<div className="attachmentCard__filename" title={fileName}>
				{fileName}
			</div>
			{meta && <div className="attachmentGate__meta">{meta}</div>}
			{note && <div className="attachmentGate__note">{note}</div>}
		</div>
	);

	return (
		<div
			className={clsx(
				'attachmentCard',
				'attachmentCard--inert',
				'attachmentGate',
				poster && 'attachmentGate--poster',
				status.kind === 'working' && 'attachmentGate--working',
				refused && 'attachmentGate--refused',
				status.kind === 'blocked' && 'attachmentCard--blocked',
				className
			)}
			role="group"
			aria-label={fileName}
		>
			{poster ? (
				<>
					<div
						className="attachmentGate__stage"
						style={aspectRatio ? { aspectRatio } : undefined}
					>
						<Glyph
							className="attachmentGate__glyph"
							aria-hidden="true"
						/>
						{action}
					</div>
					<div className="attachmentGate__row">{info}</div>
				</>
			) : (
				<div className="attachmentGate__row">
					<div className="attachmentGate__tile">
						<Glyph
							className="attachmentGate__glyph"
							aria-hidden="true"
						/>
					</div>
					{info}
					{action}
				</div>
			)}
			{progress}
		</div>
	);
};
