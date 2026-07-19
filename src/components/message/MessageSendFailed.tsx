import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { formatToHHMM } from '../../utils/dateHelpers';
import { ReactComponent as DeliveryFailedIcon } from '../../resources/img/icons/delivery-failed.svg';
import './message.styles.scss';

interface MessageSendFailedProps {
	/**
	 * The original message text that could not be delivered. Optional — the
	 * card explains the failure and asks the user to resend; the original
	 * message keeps its own bubble (with the red-cross delivery status) in the
	 * timeline.
	 */
	message?: string;
	/** Timestamp of the send attempt (ms epoch as string, like MessageItem). */
	messageTime?: string;
}

/**
 * "Sending message failed" system notification (Figma 7086-57415): error
 * avatar + bold title/subtitle header, a grey explanation bubble that spells
 * out why delivery can break (encryption / transfer) and what the delivery
 * checkmarks mean, and a red-cross delivery status in the time rail.
 */
export const MessageSendFailed = ({ messageTime }: MessageSendFailedProps) => {
	const { t: translate } = useTranslation();

	return (
		<div className="messageItem messageItem--sendFailed">
			<div className="messageItem__sendFailedHeader">
				<span className="messageItem__sendFailedAvatar" aria-hidden>
					!
				</span>
				<div className="messageItem__sendFailedHeaderText">
					<div className="messageItem__sendFailedTitle">
						{translate(
							'message.sendFailed.title',
							'Sending message failed'
						)}
					</div>
					<div className="messageItem__sendFailedSubtitle">
						{translate(
							'message.sendFailed.subtitle',
							'Resend your message again'
						)}
					</div>
				</div>
			</div>
			<div className="messageItem__messageWrap messageItem__messageWrap--left messageItem__messageWrap--sendFailed">
				<div className="messageItem__content">
					<div className="messageItem__message">
						{translate(
							'message.sendFailed.body',
							'There was a problem with sending the message, likely due to encryption or a transfer error. Please copy it and try again. Check the status: one check means sent, two checks mean read, and a cross means it didn’t reach the server.'
						)}
						<div className="messageItem__timeRail">
							<span className="messageItem__messageTime">
								{messageTime ? formatToHHMM(messageTime) : null}
								<span
									className="messageItem__deliveryStatus messageItem__deliveryStatus--failed"
									role="img"
									aria-label={translate(
										'message.sendFailed.status',
										'nicht zugestellt'
									)}
									title={translate(
										'message.sendFailed.status',
										'nicht zugestellt'
									)}
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
