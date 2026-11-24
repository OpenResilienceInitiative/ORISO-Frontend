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
	/**
	 * #2494 (Figma App.Oriso 8606:42438): a notice I triggered sits on my
	 * side, avatar right, like every message of mine. Default: someone else
	 * or the platform (Figma 9895:31375), avatar left.
	 */
	isMyMessage?: boolean;
}

/**
 * Reuses the ordinary message anatomy for a system entry.
 *
 * The avatar is the system-notice info icon from `SystemMessage` (Storybook:
 * Chat/System messages/General notices) in the same 60px avatar frame as a
 * person, not the Carimat robot: this card is written by the platform (a call
 * started or ended, an appointment, a redaction removed), not by the chatbot
 * (#2237, checkpoint 4). Same component, so same glyph, size and colour.
 */
export const ChatSystemMessageCard = ({
	title,
	subtitle,
	children,
	timestamp,
	onOpenMenu,
	dataCy = 'chat-system-message',
	isMyMessage = false
}: ChatSystemMessageCardProps) => {
	const { t: translate } = useTranslation();
	const side = isMyMessage ? 'right' : 'left';

	const kebab = onOpenMenu ? (
		<button
			type="button"
			className={`messageItem__kebabButton messageItem__kebabButton--${side}`}
			aria-label={translate('message.menu.open', 'More options')}
			onClick={onOpenMenu}
		>
			<StackVerticalIcon className="messageItem__kebabIconDefault" />
		</button>
	) : (
		<span
			className={`messageItem__kebabButton messageItem__kebabButton--${side} messageItem__kebabButton--static`}
			aria-hidden
		>
			<StackVerticalIcon className="messageItem__kebabIconDefault" />
		</span>
	);

	const avatar = (
		<div
			className="messageItem__avatar messageItem__avatar--system"
			data-testid="chat-system-message-avatar"
		>
			<SystemMessageIcon icon={ICON_INFO} />
		</div>
	);

	const sideColumn = (
		<div
			className={`messageItem__sideColumn messageItem__sideColumn--${side}`}
		>
			<div
				className={`messageItem__sideColumnGroup messageItem__sideColumnGroup--${side}`}
			>
				{isMyMessage ? (
					<>
						{kebab}
						{avatar}
					</>
				) : (
					<>
						{avatar}
						{kebab}
					</>
				)}
			</div>
		</div>
	);

	return (
		<div
			className={`messageItem messageItem--caseHandoverNotice${
				isMyMessage ? ' messageItem--right' : ''
			}`}
			data-cy={dataCy}
		>
			<div
				className={`messageItem__messageWrap messageItem__messageWrap--${side}`}
			>
				{/* First in the DOM on both sides: `--right` is row-reverse,
				   like an own message in MessageItemComponent. */}
				{sideColumn}
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
					<div
						className={`messageItem__message messageItem__message--systemNotification${
							isMyMessage
								? ' messageItem__message--myMessage'
								: ''
						}`}
					>
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
