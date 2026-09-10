import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as StackVerticalIcon } from '../../resources/img/icons/stack-vertical.svg';
import { ReactComponent as DeliverySentIcon } from '../../resources/img/icons/delivery-sent.svg';
import { CarimatRobotIcon } from '../pseudonym/PrivacyMessageCard';
import './message.styles.scss';

export interface ChatSystemMessageCardProps {
	title: string;
	/** Quiet qualifier under the title. */
	subtitle?: string;
	/** Follows the same sender orientation as every ordinary chat message. */
	side?: 'received' | 'sent';
	/** Event-specific symbol rendered in the canonical 60px avatar frame. */
	avatarIcon?: React.ReactNode;
	children?: React.ReactNode;
	timestamp?: string;
	/** Opens the message action menu; the kebab is decorative without it. */
	onOpenMenu?: () => void;
	dataCy?: string;
}

/**
 * Stand-alone system message for surfaces outside MessageItemComponent.
 * It reuses ordinary chat anatomy and M3 roles. The fallback robot belongs to
 * the configured platform assistant; event callers provide a semantic icon
 * and the real initiator name.
 */
export const ChatSystemMessageCard = ({
	title,
	subtitle,
	side = 'received',
	avatarIcon,
	children,
	timestamp,
	onOpenMenu,
	dataCy = 'chat-system-message'
}: ChatSystemMessageCardProps) => {
	const { t: translate } = useTranslation();
	const isSent = side === 'sent';
	const avatar = (
		<div className="messageItem__avatar messageItem__avatar--bot">
			<span
				className={
					avatarIcon
						? 'messageItem__eventAvatarIcon'
						: 'messageItem__botAvatarIcon'
				}
				aria-hidden
			>
				{avatarIcon || <CarimatRobotIcon />}
			</span>
		</div>
	);
	const menu = onOpenMenu ? (
		<button
			type="button"
			className={`messageItem__kebabButton messageItem__kebabButton--${
				isSent ? 'right' : 'left'
			}`}
			aria-label={translate('message.menu.open', 'More options')}
			onClick={onOpenMenu}
		>
			<StackVerticalIcon className="messageItem__kebabIconDefault" />
		</button>
	) : (
		<span
			className={`messageItem__kebabButton messageItem__kebabButton--${
				isSent ? 'right' : 'left'
			} messageItem__kebabButton--static`}
			aria-hidden
		>
			<StackVerticalIcon className="messageItem__kebabIconDefault" />
		</span>
	);

	return (
		<div
			className={`messageItem messageItem--caseHandoverNotice ${
				avatarIcon ? 'messageItem--eventSystemMessage ' : ''
			}${isSent ? 'messageItem--right' : ''}`}
			data-cy={dataCy}
		>
			<div
				className={`messageItem__messageWrap messageItem__messageWrap--${
					isSent ? 'right' : 'left'
				}`}
			>
				<div
					className={`messageItem__sideColumn messageItem__sideColumn--${
						isSent ? 'right' : 'left'
					}`}
				>
					<div
						className={`messageItem__sideColumnGroup messageItem__sideColumnGroup--${
							isSent ? 'right' : 'left'
						}`}
					>
						{isSent ? menu : avatar}
						{isSent ? avatar : menu}
					</div>
				</div>
				<div className="messageItem__content">
					<div className="messageItem__header">
						<div className="messageItem__sendFailedHeaderText messageItem__systemNotificationHeaderText">
							<div className="messageItem__sendFailedTitle">
								{title}
							</div>
							{subtitle && (
								<div className="messageItem__sendFailedSubtitle">
									{subtitle}
								</div>
							)}
						</div>
					</div>
					<div className="messageItem__message messageItem__message--systemNotification">
						{children}
						{timestamp && (
							<div className="messageItem__timeRail">
								<span className="messageItem__messageTime">
									{timestamp}
									{isSent && (
										<span
											className="messageItem__deliveryStatus messageItem__deliveryStatus--sent"
											role="img"
											aria-label={translate(
												'message.deliveryStatus.sent',
												'sent'
											)}
										>
											<DeliverySentIcon
												aria-hidden
												focusable="false"
											/>
										</span>
									)}
								</span>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

export default ChatSystemMessageCard;
