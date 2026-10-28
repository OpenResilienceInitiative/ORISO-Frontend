import * as React from 'react';
import { useTranslation } from 'react-i18next';
import ButtonBase from '@mui/material/ButtonBase';
import { UserAvatar } from '../../message/UserAvatar';
import type { CallParty } from '../callParty';
import { ReactComponent as MicOnIcon } from '../../../resources/img/icons/audio-on.svg';
import { ReactComponent as MicOffIcon } from '../../../resources/img/icons/audio-off.svg';
import { ReactComponent as HangUpIcon } from '../../../resources/img/icons/call-off.svg';
import { ReactComponent as MaximizeIcon } from '../../../resources/img/icons/maximize-content.svg';
import LockIcon from '@mui/icons-material/Lock';
import { CallSurfaceLayer } from './CallSurfaceLayer';
import './callStates.scss';

export interface MinimizedCallDockProps {
	/** The other person in a one-to-one call, as `callPartyOf` names them. */
	party: CallParty;
	/** Seconds since the call began; the caller owns the clock. */
	elapsedSeconds: number;
	isMuted: boolean;
	/** The other person is speaking right now. */
	isSpeaking?: boolean;
	onToggleMute: () => void;
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
 * The running call, put aside (FE#1904): who, how long, and the three things
 * you do to a call you are not looking at — mute, hang up, go back. The rest
 * of the control bar stays in the full view.
 */
export const MinimizedCallDock: React.FC<MinimizedCallDockProps> = ({
	party,
	elapsedSeconds,
	isMuted,
	isSpeaking = false,
	onToggleMute,
	onHangUp,
	onExpand
}) => {
	const { t } = useTranslation();
	const duration = formatCallDuration(elapsedSeconds);

	return (
		<CallSurfaceLayer>
			<section
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
