import * as React from 'react';
import { useTranslation } from 'react-i18next';
import ButtonBase from '@mui/material/ButtonBase';
import ClickAwayListener from '@mui/material/ClickAwayListener';
import MenuList from '@mui/material/MenuList';
import Paper from '@mui/material/Paper';
import Popper from '@mui/material/Popper';
import MenuItem from '@mui/material/MenuItem';
import LockIcon from '@mui/icons-material/Lock';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { UserAvatar } from '../../message/UserAvatar';
import type { CallParty } from '../callParty';
import { ReactComponent as MicOnIcon } from '../../../resources/img/icons/audio-on.svg';
import { ReactComponent as MicOffIcon } from '../../../resources/img/icons/audio-off.svg';
import { ReactComponent as HangUpIcon } from '../../../resources/img/icons/call.svg';
import { ReactComponent as MaximizeIcon } from '../../../resources/img/icons/maximize-content.svg';
import { ReactComponent as CameraOnIcon } from '../../../resources/img/icons/camera-on.svg';
import { ReactComponent as CameraOffIcon } from '../../../resources/img/icons/camera-off.svg';
import { CallSurfaceLayer } from './CallSurfaceLayer';
import './callStates.scss';

export interface MinimizedCallDockProps {
	/** The other person in a one-to-one call, as `callPartyOf` names them. */
	party: CallParty;
	/** Seconds since the call began; the caller owns the clock. */
	elapsedSeconds: number;
	isMuted: boolean;
	/** A video call; only then does the menu offer the camera. */
	isVideo?: boolean;
	isCameraOff?: boolean;
	/** The other person is speaking right now. */
	isSpeaking?: boolean;
	onToggleMute: () => void;
	onToggleCamera?: () => void;
	onHangUp: () => void;
	onExpand: () => void;
}

/** `m:ss`, or `h:mm:ss` past the hour, as the call card shows a duration. */
export const formatCallDuration = (totalSeconds: number): string => {
	const s = Math.max(0, Math.floor(totalSeconds));
	const hours = Math.floor(s / 3600);
	const minutes = Math.floor((s % 3600) / 60);
	const seconds = String(s % 60).padStart(2, '0');
	return hours
		? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}`
		: `${minutes}:${seconds}`;
};

/**
 * The running call, put aside (FE#1904): who, how long, mute, back to full
 * size, a menu, hang up. The menu holds what the host can still steer from
 * outside the call — Element Call takes mute, camera, layout and hangup from
 * its host, nothing else — and, on the narrowest phones, the way back.
 */
export const MinimizedCallDock: React.FC<MinimizedCallDockProps> = ({
	party,
	elapsedSeconds,
	isMuted,
	isVideo = false,
	isCameraOff = false,
	isSpeaking = false,
	onToggleMute,
	onToggleCamera,
	onHangUp,
	onExpand
}) => {
	const { t } = useTranslation();
	const duration = formatCallDuration(elapsedSeconds);
	const menuId = React.useId();
	const [menuAnchor, setMenuAnchor] = React.useState<HTMLElement | null>(
		null
	);
	const menuButtonRef = React.useRef<HTMLButtonElement>(null);
	const dockRef = React.useRef<HTMLElement>(null);
	const closeMenu = () => setMenuAnchor(null);

	return (
		<CallSurfaceLayer>
			<section
				ref={dockRef}
				className="minimized-call-dock"
				aria-label={t('calls.states.dockLabel', { name: party.name })}
				data-speaking={isSpeaking ? 'true' : undefined}
			>
				<div className="minimized-call-dock__who">
					<span className="minimized-call-dock__avatar">
						<UserAvatar {...party.avatar} size={40} />
					</span>
					<span className="minimized-call-dock__text">
						<span className="minimized-call-dock__name">
							{party.name}
						</span>
						<span className="minimized-call-dock__meta">
							{isSpeaking ? (
								<span
									className="minimized-call-dock__bars"
									aria-hidden="true"
								>
									<span />
									<span />
									<span />
								</span>
							) : (
								<LockIcon aria-hidden="true" />
							)}
							<span>{duration}</span>
						</span>
					</span>
				</div>
				<span className="call-visually-hidden" aria-live="polite">
					{isSpeaking
						? t('calls.states.speaking', { name: party.name })
						: ''}
				</span>

				<ButtonBase
					className={`call-icon-button${isMuted ? ' call-icon-button--off' : ''}`}
					onClick={onToggleMute}
					aria-pressed={isMuted}
					aria-label={isMuted ? t('calls.unmute') : t('calls.mute')}
				>
					{isMuted ? (
						<MicOffIcon aria-hidden="true" />
					) : (
						<MicOnIcon aria-hidden="true" />
					)}
				</ButtonBase>
				<ButtonBase
					className="call-icon-button minimized-call-dock__expand"
					onClick={onExpand}
					aria-label={t('calls.states.backToCall')}
				>
					<MaximizeIcon aria-hidden="true" />
				</ButtonBase>
				<ButtonBase
					className="call-icon-button"
					ref={menuButtonRef}
					onClick={(event) =>
						setMenuAnchor(menuAnchor ? null : event.currentTarget)
					}
					aria-label={t('calls.moreOptions')}
					aria-haspopup="menu"
					aria-expanded={menuAnchor ? true : undefined}
					aria-controls={menuAnchor ? menuId : undefined}
				>
					<MoreVertIcon aria-hidden="true" />
				</ButtonBase>
				{/*
				 * Not MUI's modal `Menu`: that hides the rest of the page from
				 * assistive technology while open, the dock included. A call menu
				 * is a popover beside a call that keeps running.
				 */}
				<Popper
					open={!!menuAnchor}
					// Anchored to the pill, not the button: right edges line up,
					// and the menu never lies over the name it belongs to.
					anchorEl={menuAnchor ? dockRef.current : null}
					placement="top-end"
					modifiers={[
						{ name: 'offset', options: { offset: [0, 8] } }
					]}
					className="call-dock-menu-popper"
				>
					<ClickAwayListener onClickAway={closeMenu}>
						<Paper className="call-dock-menu">
							<MenuList
								id={menuId}
								autoFocusItem={!!menuAnchor}
								onKeyDown={(event) => {
									if (
										event.key === 'Escape' ||
										event.key === 'Tab'
									) {
										event.preventDefault();
										closeMenu();
										menuButtonRef.current?.focus();
									}
								}}
							>
								{isVideo && onToggleCamera && (
									<MenuItem
										onClick={() => {
											closeMenu();
											onToggleCamera();
										}}
									>
										<span className="call-dock-menu__label">
											{isCameraOff
												? t('calls.turnOnVideo')
												: t('calls.turnOffVideo')}
										</span>
										{isCameraOff ? (
											<CameraOnIcon aria-hidden="true" />
										) : (
											<CameraOffIcon aria-hidden="true" />
										)}
									</MenuItem>
								)}
								<MenuItem
									onClick={() => {
										closeMenu();
										onExpand();
									}}
								>
									<span className="call-dock-menu__label">
										{t('calls.states.backToCall')}
									</span>
									<MaximizeIcon aria-hidden="true" />
								</MenuItem>
							</MenuList>
						</Paper>
					</ClickAwayListener>
				</Popper>
				<ButtonBase
					className="call-fab call-fab--hangup call-fab--small"
					onClick={onHangUp}
					aria-label={t('calls.endCall')}
				>
					<HangUpIcon aria-hidden="true" />
				</ButtonBase>
			</section>
		</CallSurfaceLayer>
	);
};
