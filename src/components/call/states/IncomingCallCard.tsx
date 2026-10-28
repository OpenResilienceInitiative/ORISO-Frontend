import * as React from 'react';
import { useTranslation } from 'react-i18next';
import ButtonBase from '@mui/material/ButtonBase';
import { UserAvatar } from '../../message/UserAvatar';
import type { CallParty } from '../callParty';
import { ReactComponent as VideoIcon } from '../../../resources/img/icons/modality-video.svg';
import { ReactComponent as AudioIcon } from '../../../resources/img/icons/modality-audio.svg';
import { ReactComponent as PhoneIcon } from '../../../resources/img/icons/call.svg';
import LockIcon from '@mui/icons-material/Lock';
import PersonIcon from '@mui/icons-material/Person';
import { CallSurfaceLayer } from './CallSurfaceLayer';
import './callStates.scss';

export interface OngoingCall {
	/** The other person's name, or the group's; empty when unknown. */
	name: string;
	/** One avatar for a one-to-one call, several (stacked) for a group. */
	avatars: CallParty['avatar'][];
}

export interface IncomingCallCardProps {
	/** From `callPartyOf`; `null` when the caller is not a party we can name. */
	caller: CallParty | null;
	isVideo: boolean;
	/**
	 * The call already running. Answering ends it, and the card says so — and
	 * shows whom it ends for, struck through — before anybody presses anything.
	 */
	ongoingCall?: OngoingCall | null;
	onAnswer: () => void;
	onDecline: () => void;
}

/**
 * The incoming call, in the call stage's own language (FE#1904): the caller
 * drawn by the stage's identity rules, the modality and the encryption as one
 * quiet line, and the two decisions as the call's own round buttons.
 *
 * A dialog for assistive technology, but not a modal one: the app behind it
 * stays usable, which is why there is no backdrop.
 */
export const IncomingCallCard: React.FC<IncomingCallCardProps> = ({
	caller,
	isVideo,
	ongoingCall,
	onAnswer,
	onDecline
}) => {
	const { t } = useTranslation();
	const titleId = React.useId();
	const metaId = React.useId();
	const modality = isVideo ? t('calls.videoCall') : t('calls.audioCall');
	const ModalityIcon = isVideo ? VideoIcon : AudioIcon;

	return (
		<CallSurfaceLayer>
			<section
				className="incoming-call-card"
				role="alertdialog"
				aria-labelledby={titleId}
				aria-describedby={metaId}
				data-busy={ongoingCall ? 'true' : undefined}
			>
				<div className="incoming-call-card__ring" aria-hidden="true">
					<span className="incoming-call-card__pulse" />
					<span className="incoming-call-card__pulse incoming-call-card__pulse--late" />
					{caller ? (
						<UserAvatar {...caller.avatar} size={88} />
					) : (
						<span className="incoming-call-card__unknown">
							<PersonIcon />
						</span>
					)}
				</div>

				<h2 id={titleId} className="incoming-call-card__name">
					{caller
						? caller.name
						: t('calls.group.incomingDescription')}
				</h2>
				<p id={metaId} className="incoming-call-card__meta">
					<ModalityIcon aria-hidden="true" />
					<span>{modality}</span>
					<span aria-hidden="true">·</span>
					<LockIcon aria-hidden="true" />
					<span>{t('calls.states.encrypted')}</span>
				</p>

				{ongoingCall && (
					<div className="incoming-call-card__busy">
						{ongoingCall.avatars.length > 0 && (
							<span
								className="incoming-call-card__ending"
								aria-hidden="true"
							>
								{ongoingCall.avatars
									.slice(0, 3)
									.map((avatar) => (
										<UserAvatar
											key={avatar.userId}
											{...avatar}
											size={32}
										/>
									))}
							</span>
						)}
						<p>
							{ongoingCall.name
								? t('calls.states.endsCurrent', {
										name: ongoingCall.name
									})
								: t('calls.states.endsCurrentUnnamed')}
						</p>
					</div>
				)}

				<div className="incoming-call-card__actions">
					<div className="call-action">
						<ButtonBase
							className="call-fab call-fab--hangup"
							onClick={onDecline}
							aria-label={t('calls.decline')}
						>
							<PhoneIcon aria-hidden="true" />
						</ButtonBase>
						<span className="call-action__label" aria-hidden="true">
							{t('calls.decline')}
						</span>
					</div>
					<div className="call-action">
						<ButtonBase
							className="call-fab call-fab--answer"
							onClick={onAnswer}
							aria-label={
								ongoingCall
									? t('calls.states.answerAndEnd')
									: t('calls.answer')
							}
						>
							{isVideo ? (
								<VideoIcon aria-hidden="true" />
							) : (
								<PhoneIcon aria-hidden="true" />
							)}
						</ButtonBase>
						<span className="call-action__label" aria-hidden="true">
							{ongoingCall
								? t('calls.states.answerAndEnd')
								: t('calls.answer')}
						</span>
					</div>
				</div>
			</section>
		</CallSurfaceLayer>
	);
};
