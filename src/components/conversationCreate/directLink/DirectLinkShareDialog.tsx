import * as React from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import CheckOutlinedIcon from '@mui/icons-material/CheckOutlined';
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import { M3Dialog } from '../../m3Dialog/M3Dialog';
import { copyTextToClipboard } from '../../../utils/clipboardHelpers';
import { DirectLink } from './directLink';
import { DirectLinkMediumIcon } from './DirectLinkMediumIcon';
import './directLink.styles.scss';

interface DirectLinkShareDialogProps {
	open: boolean;
	link: DirectLink;
	onClose: () => void;
	fullScreen?: boolean;
	onCopy?: (url: string) => void | Promise<void>;
}

/**
 * #1795: shown right after a direct link was created — link with Copy,
 * QR code and Share, like the self-help circle's share dialog. The link then
 * lives under the clock entry ("Meine Direktlinks").
 */
export const DirectLinkShareDialog = ({
	open,
	link,
	onClose,
	fullScreen = false,
	onCopy = (url) => copyTextToClipboard(url)
}: DirectLinkShareDialogProps) => {
	const { t } = useTranslation();
	const [qr, setQr] = useState('');
	const [copied, setCopied] = useState(false);
	const [copyFailed, setCopyFailed] = useState(false);

	useEffect(() => {
		QRCode.toDataURL(link.url, { errorCorrectionLevel: 'M', width: 320 })
			.then(setQr)
			.catch(() => setQr(''));
	}, [link.url]);

	useEffect(() => {
		if (!open) {
			setCopied(false);
			setCopyFailed(false);
		}
	}, [open]);

	const canShare = typeof navigator !== 'undefined' && 'share' in navigator;

	return (
		<M3Dialog
			open={open}
			onClose={onClose}
			fullScreen={fullScreen}
			width={480}
			closeLabel={t('app.close')}
			icon={<LinkOutlinedIcon />}
			title={t('directLink.share.title')}
			description={t('directLink.share.description')}
			className="directLinkShareDialog"
			data-testid="direct-link-share-dialog"
			actions={[
				{
					label: t('directLink.share.done'),
					onClick: onClose,
					primary: true
				}
			]}
		>
			<div className="directLinkShareDialog__summary">
				<DirectLinkMediumIcon medium={link.medium} />
				<span>
					{t(`directLink.medium.${link.medium.toLowerCase()}`)} ·{' '}
					{link.topic}
				</span>
				{link.temporary && (
					<span className="directLinkChip">
						{t('directLink.temporary')}
					</span>
				)}
			</div>
			{qr && (
				<img
					className="directLinkShareDialog__qr"
					src={qr}
					alt={t('directLink.share.qrAlt')}
					width={160}
					height={160}
				/>
			)}
			<div className="directLinkShareDialog__linkRow">
				<input
					aria-label={t('directLink.share.linkLabel')}
					className="directLinkShareDialog__linkField"
					readOnly
					value={link.url}
					onFocus={(event) => event.currentTarget.select()}
				/>
				<button
					type="button"
					className="directLinkShareDialog__action"
					onClick={async () => {
						try {
							await onCopy(link.url);
							setCopyFailed(false);
							setCopied(true);
						} catch {
							setCopied(false);
							setCopyFailed(true);
						}
					}}
				>
					{copied ? (
						<CheckOutlinedIcon aria-hidden />
					) : (
						<ContentCopyOutlinedIcon aria-hidden />
					)}
					{t(copied ? 'directLink.share.copied' : 'directLink.copy')}
				</button>
				{canShare && (
					<button
						type="button"
						className="directLinkShareDialog__action"
						onClick={() =>
							navigator
								.share({ url: link.url, title: link.name })
								.catch(() => undefined)
						}
					>
						<ShareOutlinedIcon aria-hidden />
						{t('directLink.share.share')}
					</button>
				)}
			</div>
			{copyFailed && (
				<p role="alert" className="directLinkCopyError">
					{t('groupChat.shareDialog.copyFailed')}
				</p>
			)}
		</M3Dialog>
	);
};
