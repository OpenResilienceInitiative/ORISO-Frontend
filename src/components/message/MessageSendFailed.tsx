import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { formatToHHMM } from '../../utils/dateHelpers';
import { ReactComponent as DeliveryFailedIcon } from '../../resources/img/icons/delivery-failed.svg';
import './message.styles.scss';

interface MessageSendFailedProps {
	/** Timestamp of the send attempt (ms epoch as string, like MessageItem). */
	messageTime?: string;
	/** Render copy for an incoming event that could not be decrypted. */
	isDecryptionFailure?: boolean;
	/** Retry this outgoing message once through the normal send pipeline. */
	onRetry?: () => void;
	/** Prevent concurrent retry clicks while the send is in flight. */
	retryPending?: boolean;
	/** Disable this entry while a different failed message is retrying. */
	retryDisabled?: boolean;
}

/**
 * Failure notification for an outgoing send or an incoming message that could
 * not be decrypted. Both variants share the same chat-card presentation while
 * keeping their instructions specific to what the user can actually do.
 */
export const MessageSendFailed = ({
	messageTime,
	isDecryptionFailure = false,
	onRetry,
	retryPending = false,
	retryDisabled = false
}: MessageSendFailedProps) => {
	const { t: translate } = useTranslation();
	const copy = isDecryptionFailure
		? {
				title: translate(
					'message.decryptionFailed.title',
					'Message decryption failed'
				),
				subtitle: translate(
					'message.decryptionFailed.subtitle',
					'Incoming message unavailable'
				),
				body: translate(
					'message.decryptionFailed.body',
					'This incoming message could not be decrypted. Ask the sender to send it again, or try reloading the conversation.'
				),
				status: translate(
					'message.decryptionFailed.status',
					'could not be decrypted'
				)
			}
		: {
				title: translate(
					'message.sendFailed.title',
					'Sending message failed'
				),
				subtitle: translate(
					'message.sendFailed.subtitle',
					'Resend your message again'
				),
				body: translate(
					'message.sendFailed.body',
					'There was a problem with sending the message, likely due to encryption or a transfer error. Select Try again to retry once. Check the status: one check means sent, two checks mean read, and a cross means it didn’t reach the server.'
				),
				status: translate('message.sendFailed.status', 'not delivered')
			};

	return (
		<div className="messageItem messageItem--sendFailed">
			<div className="messageItem__messageWrap messageItem__messageWrap--left">
				<div className="messageItem__sideColumn messageItem__sideColumn--left">
					<div className="messageItem__sideColumnGroup">
						<div className="messageItem__avatar">
							<span
								className="messageItem__sendFailedAvatar"
								aria-hidden
							>
								!
							</span>
						</div>
					</div>
				</div>
				<div className="messageItem__content">
					<div className="messageItem__header">
						<div className="messageItem__sendFailedHeaderText">
							<div className="messageItem__sendFailedTitle">
								{copy.title}
							</div>
							<div className="messageItem__sendFailedSubtitle">
								{copy.subtitle}
							</div>
						</div>
					</div>
					<div className="messageItem__message">
						{copy.body}
						<div className="messageItem__timeRail">
							{!isDecryptionFailure && onRetry && (
								<button
									type="button"
									className="messageItem__sendFailedRetry"
									onClick={onRetry}
									disabled={retryPending || retryDisabled}
								>
									{translate(
										'message.sendFailed.retry',
										'Try again'
									)}
								</button>
							)}
							<span className="messageItem__messageTime">
								{messageTime ? formatToHHMM(messageTime) : null}
								<span
									className="messageItem__deliveryStatus messageItem__deliveryStatus--failed"
									role="img"
									aria-label={copy.status}
									title={copy.status}
								>
									<DeliveryFailedIcon
										aria-hidden
										focusable="false"
									/>
								</span>
							</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};
