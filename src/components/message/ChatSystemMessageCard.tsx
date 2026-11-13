import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as StackVerticalIcon } from '../../resources/img/icons/stack-vertical.svg';
import { ReactComponent as DeliverySentIcon } from '../../resources/img/icons/delivery-sent.svg';
import { ICON_INFO, SystemMessageIcon } from './SystemMessage';
import './message.styles.scss';

export interface ChatSystemMessageCardProps {
	title: string;
	subtitle?: string;
	children?: React.ReactNode;
	timestamp?: string;
	onOpenMenu?: () => void;
	dataCy?: string;
}

/**
 * Reuses the ordinary incoming-message anatomy for a system entry.
 *
 * The avatar is the system-notice info icon from `SystemMessage` (Storybook:
 * Chat/System messages/General notices), not the Carimat robot: this card is
 * written by the platform (a call started or ended), not by the chatbot
 * (#2237, checkpoint 4). Same component, so same glyph, size and colour.
 */
export const ChatSystemMessageCard = ({
	title,
	subtitle,
	children,
	timestamp,
	onOpenMenu,
	dataCy = 'chat-system-message'
}: ChatSystemMessageCardProps) => {
	const { t: translate } = useTranslation();

	return (
		<div
			className="messageItem messageItem--caseHandoverNotice"
			data-cy={dataCy}
		>
			<div className="messageItem__messageWrap messageItem__messageWrap--left">
				<div className="messageItem__sideColumn messageItem__sideColumn--left">
					<div className="messageItem__sideColumnGroup messageItem__sideColumnGroup--left">
						<div
							className="messageItem__avatar messageItem__avatar--system"
							data-testid="chat-system-message-avatar"
						>
							<SystemMessageIcon icon={ICON_INFO} />
						</div>
						{onOpenMenu ? (
							<button
								type="button"
								className="messageItem__kebabButton messageItem__kebabButton--left"
								aria-label={translate(
									'message.menu.open',
									'More options'
								)}
								onClick={onOpenMenu}
							>
								<StackVerticalIcon className="messageItem__kebabIconDefault" />
							</button>
						) : (
							<span
								className="messageItem__kebabButton messageItem__kebabButton--left messageItem__kebabButton--static"
								aria-hidden
							>
								<StackVerticalIcon className="messageItem__kebabIconDefault" />
							</span>
						)}
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
