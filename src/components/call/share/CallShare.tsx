import * as React from 'react';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Drawer, Popover, PopoverActions } from '@mui/material';
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined';
import { CallSharePanel } from './CallSharePanel';
import {
	CallShareSettings,
	defaultCallShareSettings,
	detectWebShare,
	WebShare
} from './callShareSettings';
import './callShare.scss';

export interface CallShareProps {
	/** The guest link of this one call (backend later; #1794). */
	link: string;
	/**
	 * Desktop: popover anchored at the toolbar button. Phone: bottom sheet.
	 * The caller decides the breakpoint, like `M3Dialog.fullScreen`.
	 */
	layout: 'desktop' | 'phone';
	defaultOpen?: boolean;
	initialSettings?: CallShareSettings;
	onSettingsChange?: (settings: CallShareSettings) => void;
	onCopy?: (link: string) => void | Promise<void>;
	/** Omitted: the browser's own `navigator.share`, if any. `null`: hidden. */
	webShare?: WebShare | null;
	defaultQrOpen?: boolean;
	/** `false` when the platform or Träger forbids temporary accounts. */
	temporaryAccountAllowed?: boolean;
}

/**
 * The share button of the call toolbar and what it opens (#1794): a popover
 * above the button on desktop, a bottom sheet on phones. Host side, next to
 * the Element Call iframe — no widget capability needed (Shazia, #1794).
 */
export const CallShare = ({
	link,
	layout,
	defaultOpen = false,
	initialSettings,
	onSettingsChange,
	onCopy,
	webShare,
	defaultQrOpen,
	temporaryAccountAllowed = true
}: CallShareProps) => {
	const { t } = useTranslation();
	const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
	const [open, setOpen] = useState(defaultOpen);
	const [settings, setSettings] = useState<CallShareSettings>(() => {
		const initial = initialSettings ?? defaultCallShareSettings();
		// Not allowed means not offered: the link carries no temporary account.
		return temporaryAccountAllowed
			? initial
			: { ...initial, temporaryAccount: false };
	});
	const [share] = useState<WebShare | null>(() =>
		webShare === undefined ? detectWebShare() : webShare
	);

	const popoverActions = useRef<PopoverActions>(null);
	// The popover grows upwards from the button: re-anchor when it grows.
	const reanchor = useCallback(
		() => popoverActions.current?.updatePosition(),
		[]
	);

	const close = () => setOpen(false);
	const panel = (
		<CallSharePanel
			link={link}
			settings={settings}
			onSettingsChange={(next) => {
				setSettings(next);
				onSettingsChange?.(next);
			}}
			onClose={close}
			webShare={share}
			onCopy={onCopy}
			defaultQrOpen={defaultQrOpen}
			temporaryAccountAllowed={temporaryAccountAllowed}
			onContentResize={layout === 'desktop' ? reanchor : undefined}
		/>
	);

	return (
		<>
			<button
				ref={setAnchor}
				type="button"
				className={`callShare__trigger${
					open ? ' callShare__trigger--active' : ''
				}`}
				aria-label={t('calls.share.open')}
				aria-haspopup="dialog"
				aria-expanded={open}
				onClick={() => setOpen((value) => !value)}
			>
				<span className="callShare__triggerInner">
					<ShareOutlinedIcon aria-hidden />
				</span>
			</button>
			{layout === 'desktop' ? (
				<Popover
					action={popoverActions}
					open={open && anchor !== null}
					anchorEl={anchor}
					onClose={close}
					anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
					transformOrigin={{
						vertical: 'bottom',
						horizontal: 'center'
					}}
					slotProps={{ paper: { className: 'callShare__popover' } }}
				>
					{panel}
				</Popover>
			) : (
				<Drawer
					anchor="bottom"
					open={open}
					onClose={close}
					PaperProps={{ className: 'callShare__sheet' }}
				>
					<span className="callShare__handle" aria-hidden />
					{panel}
				</Drawer>
			)}
		</>
	);
};
