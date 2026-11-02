import * as React from 'react';
import { useEffect, useId, useLayoutEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import { IconButton } from '@mui/material';
import CheckOutlinedIcon from '@mui/icons-material/CheckOutlined';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import DoorFrontOutlinedIcon from '@mui/icons-material/DoorFrontOutlined';
import HistoryToggleOffOutlinedIcon from '@mui/icons-material/HistoryToggleOffOutlined';
import QrCode2OutlinedIcon from '@mui/icons-material/QrCode2Outlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined';
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined';
import { Switch } from '../../Switch';
import {
	copyLinkToClipboard,
	type CallShareSettings,
	type WebShare
} from './callShareSettings';
import './callShare.scss';

export interface CallSharePanelProps {
	link: string;
	settings: CallShareSettings;
	onSettingsChange: (settings: CallShareSettings) => void;
	onClose: () => void;
	/** `null` hides the Share button (no Web Share API in this browser). */
	webShare: WebShare | null;
	onCopy?: (link: string) => void | Promise<void>;
	/** Stories open the QR code directly; the app starts collapsed. */
	defaultQrOpen?: boolean;
	/** The content changed height (QR shown or hidden); the popover re-anchors. */
	onContentResize?: () => void;
	/**
	 * Platform or Träger forbids temporary accounts: the toggle is not shown
	 * at all (Frank, 28 Oct), rather than shown disabled.
	 */
	temporaryAccountAllowed?: boolean;
}

/**
 * The content of the call share surface (#1794), the same in the desktop
 * popover and the phone bottom sheet: two toggles, the link with Copy, a QR
 * code and the phone's own share menu, then two plain sentences on lifetime
 * and consent. Copy and link field follow the self-help share dialog
 * (`GroupChatShareDialog`), the surface follows the call menu (plate 5b).
 */
export const CallSharePanel = ({
	link,
	settings,
	onSettingsChange,
	onClose,
	webShare,
	onCopy = (value) => copyLinkToClipboard(value),
	defaultQrOpen = false,
	onContentResize,
	temporaryAccountAllowed = true
}: CallSharePanelProps) => {
	const { t } = useTranslation();
	const id = useId();
	const [copied, setCopied] = useState(false);
	const [copying, setCopying] = useState(false);
	const [copyFailed, setCopyFailed] = useState(false);
	const [qrOpen, setQrOpen] = useState(defaultQrOpen);
	const [qr, setQr] = useState('');

	useEffect(() => {
		if (!qrOpen) {
			return undefined;
		}
		let active = true;
		QRCode.toDataURL(link, { errorCorrectionLevel: 'M', width: 320 })
			.then((dataUrl) => active && setQr(dataUrl))
			.catch(() => active && setQr(''));
		return () => {
			active = false;
		};
	}, [link, qrOpen]);

	useLayoutEffect(() => {
		onContentResize?.();
	}, [qrOpen, qr, onContentResize]);

	const handleCopy = async () => {
		if (copying) {
			return;
		}
		setCopying(true);
		setCopyFailed(false);
		try {
			await onCopy(link);
			setCopied(true);
		} catch {
			setCopied(false);
			setCopyFailed(true);
		} finally {
			setCopying(false);
		}
	};

	const toggles: {
		key: keyof CallShareSettings;
		icon: React.ReactNode;
	}[] = [
		{ key: 'knock', icon: <DoorFrontOutlinedIcon /> },
		...(temporaryAccountAllowed
			? [
					{
						key: 'temporaryAccount' as const,
						icon: <HistoryToggleOffOutlinedIcon />
					}
				]
			: [])
	];

	return (
		<div
			className="callShare"
			role="dialog"
			aria-labelledby={`${id}-title`}
			data-testid="call-share-panel"
		>
			<div className="callShare__header">
				<h2 id={`${id}-title`} className="callShare__title">
					{t('calls.share.title')}
				</h2>
				<IconButton
					className="callShare__close"
					aria-label={t('calls.share.close')}
					onClick={onClose}
					size="small"
				>
					<CloseOutlinedIcon />
				</IconButton>
			</div>

			<p className="callShare__sectionLabel">
				{t('calls.share.settingsLabel')}
			</p>
			<ul className="callShare__toggles">
				{toggles.map(({ key, icon }) => {
					const on = settings[key];
					const inputId = `${id}-${key}`;
					return (
						<li className="callShare__toggle" key={key}>
							<span className="callShare__toggleIcon" aria-hidden>
								{icon}
							</span>
							<label
								className="callShare__toggleText"
								htmlFor={inputId}
							>
								<span
									id={`${inputId}-label`}
									className="callShare__toggleLabel"
								>
									{t(`calls.share.${key}.label`)}
								</span>
								<span
									id={`${inputId}-description`}
									className="callShare__toggleDescription"
								>
									{t(
										`calls.share.${key}.${on ? 'on' : 'off'}`
									)}
								</span>
							</label>
							<Switch
								id={inputId}
								checked={on}
								aria-labelledby={`${inputId}-label`}
								aria-describedby={`${inputId}-description`}
								onChange={(checked) =>
									onSettingsChange({
										...settings,
										[key]: checked
									})
								}
							/>
						</li>
					);
				})}
			</ul>
			{/* Frank, 28 Oct: a change applies to the link already shared. */}
			<p className="callShare__settingsHint">
				{t('calls.share.settingsLive')}
			</p>

			<label className="callShare__sectionLabel" htmlFor={`${id}-link`}>
				{t('calls.share.linkLabel')}
			</label>
			<div className="callShare__linkRow">
				<input
					id={`${id}-link`}
					className="callShare__linkField"
					type="text"
					readOnly
					value={link}
					onFocus={(event) => event.currentTarget.select()}
				/>
				<button
					type="button"
					className={`callShare__copy${
						copied ? ' callShare__copy--done' : ''
					}`}
					onClick={handleCopy}
					disabled={copying}
				>
					{copied ? (
						<CheckOutlinedIcon aria-hidden />
					) : (
						<ContentCopyOutlinedIcon aria-hidden />
					)}
					<span>
						{t(copied ? 'calls.share.copied' : 'calls.share.copy')}
					</span>
				</button>
			</div>
			<p className="callShare__status" aria-live="polite">
				{copied
					? t('calls.share.copiedStatus')
					: copyFailed
						? t('calls.share.copyFailed')
						: ''}
			</p>

			<div className="callShare__actions">
				<button
					type="button"
					className="callShare__tonal"
					aria-expanded={qrOpen}
					aria-controls={`${id}-qr`}
					onClick={() => setQrOpen((open) => !open)}
				>
					<QrCode2OutlinedIcon aria-hidden />
					<span>
						{t(
							qrOpen ? 'calls.share.qrHide' : 'calls.share.qrShow'
						)}
					</span>
				</button>
				{webShare && (
					<button
						type="button"
						className="callShare__tonal"
						onClick={() =>
							webShare({
								title: t('calls.share.shareTitle'),
								url: link
							}).catch(() => undefined)
						}
					>
						<ShareOutlinedIcon aria-hidden />
						<span>{t('calls.share.share')}</span>
					</button>
				)}
			</div>
			{qrOpen && (
				<div id={`${id}-qr`} className="callShare__qr">
					<span className="callShare__qrPlate">
						{qr ? (
							<img
								src={qr}
								alt={t('calls.share.qrAlt')}
								width={120}
								height={120}
							/>
						) : (
							<span
								className="callShare__qrPlaceholder"
								aria-hidden
							/>
						)}
					</span>
					<span className="callShare__qrHint">
						{t('calls.share.qrHint')}
					</span>
				</div>
			)}

			<ul className="callShare__notes">
				<li>
					<ScheduleOutlinedIcon aria-hidden />
					<span>{t('calls.share.lifetime')}</span>
				</li>
				<li>
					<VerifiedUserOutlinedIcon aria-hidden />
					<span>{t('calls.share.consent')}</span>
				</li>
			</ul>
		</div>
	);
};
